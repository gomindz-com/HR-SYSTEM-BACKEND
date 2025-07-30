import jwt from "jsonwebtoken";
// export const generateToken = (userId, res) => {
//   const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
//     expiresIn: "7d",
//   });

//   res.cookie("jwt", token, {
//     maxAge: 7 * 24 * 60 * 60 * 1000,
//     httpOnly: true,
//     sameSite: process.env.NODE_ENV === "development" ? "strict" : "none",
//     secure: process.env.NODE_ENV !== "development",
//   });
//   return token;
// };
export const generateToken = (userId, res) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const isProd = process.env.NODE_ENV === "production";

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProd,           // only allow over HTTPS in prod
    sameSite: isProd ? "none" : "lax",
    path: "/",                // make sure it’s available on every backend route
    // domain: your custom domain if you have one
  });

  return token;
};
