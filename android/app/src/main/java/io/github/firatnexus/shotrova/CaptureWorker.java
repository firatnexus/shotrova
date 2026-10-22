package io.github.firatnexus.shotrova;

import android.content.Context;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/**
 * Background work for automatic screenshot capture.
 *
 * Two complementary mechanisms, both honest about their limits:
 * 1. A content-URI-triggered one-time worker (WorkManager wraps JobScheduler's
 *    trigger): fires within ~1 minute of a MediaStore change while the system
 *    keeps it scheduled — including after the app is swiped away. Re-arms
 *    itself after every run. This is the fast path.
 * 2. A periodic catch-up worker (every 15 minutes): catches anything the
 *    trigger missed (OEM battery managers can defer triggers; Xiaomi's
 *    "Pil kısıtı" state is surfaced in the UI).
 *
 * No foreground service is used: a dataSync FGS is capped at 6 hours per day
 * on Android 15+, and a persistent notification for a screenshot organiser is
 * not worth it. If the system kills work under aggressive battery
 * restrictions, the catch-up scan on next app launch fills the gap.
 */
public class CaptureWorker extends Worker {

    private static final String TRIGGER_WORK = "shotrova-capture-trigger";
    private static final String CATCHUP_WORK = "shotrova-capture-catchup";
    private static final String ANALYSIS_WORK = "shotrova-capture-analysis";

    public CaptureWorker(Context context, WorkerParameters params) {
        super(context, params);
    }

    @Override
    public Result doWork() {
        try {
            CaptureScanner.get().scan(getApplicationContext());
        } catch (Exception e) {
            // A failed scan must not kill the trigger chain.
        }
        // Fast path only works while armed; re-arm unless the feature is off.
        armTrigger(getApplicationContext());
        return Result.success();
    }

    /** (Re)arms the content-trigger fast path if the feature is enabled. */
    static void armTrigger(Context ctx) {
        CaptureStore store = new CaptureStore(ctx);
        if (!store.isEnabled()) {
            WorkManager.getInstance(ctx).cancelUniqueWork(TRIGGER_WORK);
            WorkManager.getInstance(ctx).cancelUniqueWork(CATCHUP_WORK);
            return;
        }
        Constraints c = new Constraints.Builder()
            .addContentUriTrigger(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true)
            .build();
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(CaptureWorker.class)
            .setConstraints(c)
            .build();
        // REPLACE (not APPEND): if a previous trigger chain ever fails,
        // the next scan re-arms cleanly instead of appending to a dead chain.
        WorkManager.getInstance(ctx).enqueueUniqueWork(TRIGGER_WORK, ExistingWorkPolicy.REPLACE, req);
        // The periodic catch-up below is the safety net for OEM battery
        // managers that defer content triggers (Xiaomi "Pil kısıtı").
        armCatchup(ctx);
    }

    /** Periodic catch-up scan (15 min minimum interval enforced by WorkManager). */
    static void armCatchup(Context ctx) {
        CaptureStore store = new CaptureStore(ctx);
        if (!store.isEnabled()) {
            WorkManager.getInstance(ctx).cancelUniqueWork(CATCHUP_WORK);
            return;
        }
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(CaptureWorker.class, 15, TimeUnit.MINUTES)
            .build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(CATCHUP_WORK, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    /** Queues a network-bound retry for pending AI analyses. */
    static void queueAnalysisRetry(Context ctx) {
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(CaptureWorker.class)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInitialDelay(1, TimeUnit.MINUTES)
            .build();
        WorkManager.getInstance(ctx).enqueueUniqueWork(ANALYSIS_WORK, ExistingWorkPolicy.REPLACE, req);
    }

    /** True when the trigger/catch-up chain is scheduled. */
    static boolean isArmed(Context ctx) {
        try {
            return !WorkManager.getInstance(ctx)
                .getWorkInfosForUniqueWork(TRIGGER_WORK).get().isEmpty()
                || !WorkManager.getInstance(ctx)
                .getWorkInfosForUniqueWork(CATCHUP_WORK).get().isEmpty();
        } catch (Exception e) {
            return false;
        }
    }
}
