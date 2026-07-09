const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const PASTA_UPLOADS = path.join(__dirname, '..', 'uploads');
const LIMITE_BYTES = 50 * 1024 * 1024; // 50MB, mesmo limite do CHECK no banco

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
  filename: (req, file, cb) => {
    const sufixo = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${sufixo}${ext}`);
  },
});

// Extensões aceitas para anexos de chamados: imagens (fotos de tela/equipamento
// com defeito) e documentos comuns de escritório. Bloqueia executáveis e
// scripts (.exe, .bat, .js, .html etc), que não têm motivo de estar aqui e
// evita servir de vetor de XSS armazenado caso o arquivo seja aberto direto
// pelo navegador.
const EXTENSOES_PERMITIDAS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt',
]);

function filtroDeArquivo(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXTENSOES_PERMITIDAS.has(ext)) {
    const erro = new Error(`Tipo de arquivo não permitido (${ext || 'sem extensão'}). Envie imagem, PDF, Word, Excel ou texto.`);
    erro.status = 400;
    return cb(erro);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: LIMITE_BYTES },
  fileFilter: filtroDeArquivo,
});

module.exports = { upload, PASTA_UPLOADS, EXTENSOES_PERMITIDAS };
