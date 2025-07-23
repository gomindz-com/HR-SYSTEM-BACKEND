import jwt from "jsonwebtoken";

export const verifyQrPayload = (qrPayload) => {
  try {
    const decoded = jwt.verify(qrPayload, process.env.QR_SECRET);
    return decoded;
  } catch (error) {
    console.log("Error in Verify Qr Payload", error);
    return null;
  }
};

export const generateQrJwt = (companyId) => {
  const payload = {
    data: {
      companyId,
    },
  };

  const token = jwt.sign(payload, process.env.QR_SECRET, { expiresIn: "5m" });
  return token;
};
