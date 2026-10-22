package io.github.firatnexus.shotrova;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

/**
 * After a reboot WorkManager restores its persisted schedule by itself; this
 * receiver additionally kicks off one immediate catch-up scan so screenshots
 * taken while the phone was off are picked up right away instead of waiting
 * for the next trigger/period.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        try {
            CaptureWorker.armTrigger(context);
            WorkManager.getInstance(context).enqueueUniqueWork(
                "shotrova-capture-boot", ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(CaptureWorker.class).build());
        } catch (Exception e) {
            Log.w("Shotrova", "boot catch-up failed", e);
        }
    }
}
