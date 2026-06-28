import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function DownloadQRCode() {
  const [qr, setQr] = useState("");

  useEffect(() => {
    QRCode.toDataURL("https://global-muslims-connect.com", {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    }).then(setQr);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      {qr && (
        <img
          src={qr}
          alt="QR Code for Tariq Islam app"
          className="w-40 h-40"
        />
      )}
      <p className="text-sm font-medium text-center">
        Scan to get the app
      </p>
    </div>
  );
}