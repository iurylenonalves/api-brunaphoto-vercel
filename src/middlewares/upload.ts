import multer from "multer";
export const upload = multer({ dest: "uploads/" }); // Adjust for Vercel Blob later