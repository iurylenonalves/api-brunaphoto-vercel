import multer from "multer";
//export const upload = multer({ dest: "/tmp" }); // Adjust for Vercel Blob later / antes era "uploads/"

// Configura o Multer para usar armazenamento em memória.
// Isso significa que o arquivo enviado ficará disponível como um Buffer em `req.file.buffer`.
const storage = multer.memoryStorage();

// Define um filtro para aceitar apenas tipos de imagem comuns.
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Aceita o arquivo
  } else {
    cb(new Error('Invalid file type, only images are allowed!')); // Rejeita o arquivo
  }
};

export const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 10 // Limite de 10MB por arquivo
  }
});