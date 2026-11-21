import os
import urllib.request
import urllib.parse

targets = [
    "E:/nusaroute-ai/test-fixtures",
    "E:/nusaroute-ai/backend/test-fixtures",
    "E:/nusaroute-ai/frontend/public/samples"
]

for t in targets:
    os.makedirs(t, exist_ok=True)

audios = [
    {
        "filename": "sample-voice.mp3",
        "alias": "sample-voice-flood.mp3",
        "text": "Halo dispatcher, kurir melaporkan jalan Wonokromo Surabaya macet total dan banjir sekitar 40 sentimeter setelah hujan lebat. Sepeda motor tidak bisa lewat, mohon info rute alternatif ke hub terdekat."
    },
    {
        "filename": "sample-voice-traffic.mp3",
        "alias": "sample-voice-traffic.mp3",
        "text": "Lapor dispatcher, di persimpangan jalan Ahmad Yani arah Darmo terjadi kemacetan parah dan antrean padat merayap sepanjang 800 meter. Estimasi keterlambatan paket sekitar 15 menit."
    }
]

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

for item in audios:
    url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=" + urllib.parse.quote(item["text"])
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            for t in targets:
                out_path = os.path.join(t, item["filename"])
                with open(out_path, "wb") as f:
                    f.write(data)
                if item["alias"] != item["filename"]:
                    with open(os.path.join(t, item["alias"]), "wb") as f:
                        f.write(data)
        print("Generated " + item["filename"] + " size: " + str(len(data)) + " bytes")
    except Exception as e:
        print("Failed to generate " + item["filename"] + ": " + str(e))
