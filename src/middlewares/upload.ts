import multer from "multer";
export const upload = multer({ dest: "/tmp" }); // Adjust for Vercel Blob later / antes era "uploads/"