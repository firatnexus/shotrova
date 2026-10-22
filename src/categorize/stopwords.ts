import { fold } from '../search/normalize';

/** Common Turkish and English function words, stored folded. */
const RAW = `
ve veya ile bir bu su o da de mi mu ki icin gibi daha cok en ama fakat ancak ya hem her hic ne nasil neden niye
kim hangi ben sen biz siz onlar bana sana beni seni bizi sizi benim senin onun bizim sizin olan olarak oldu olur
var yok degil ise kadar sonra once ile ayni diger tum butun simdi sadece bile artik zaten belki evet hayir
kaydettigim kaydettiklerim kaydedilen kaydet kayit gosterilen goster bul bulunan ara arama resim resimler gorsel
gorseller ekran goruntusu goruntu goruntuleri
the a an and or of to in on at for from with by is are was were be been it its this that these those as
my your our their me you we they he she his her them not no yes but if then so than too very can will just
saved save show find image images screenshot screenshots picture pictures photo photos about
`;

export const STOPWORDS: ReadonlySet<string> = new Set(
  RAW.split(/\s+/)
    .map((w) => fold(w))
    .filter(Boolean),
);
