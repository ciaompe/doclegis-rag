const { v4 } = require("uuid");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../../utils/files");
const { tokenizeString } = require("../../../utils/tokenizer");
const { default: slugify } = require("slugify");
const PDFLoader = require("./PDFLoader");
const OCRLoader = require("../../../utils/OCRLoader");

async function asPdf({ fullFilePath = "", filename = "" }) {
  const pdfLoader = new PDFLoader(fullFilePath, {
    splitPages: true,
  });

  console.log(`-- Working ${filename} --`);
  const pageContent = [];
  let docs = await pdfLoader.load();

  if (docs.length === 0) {
    console.log(
      `[asPDF] No text content found for ${filename}. Will attempt OCR parse.`
    );
    docs = await new OCRLoader().ocrPDF(fullFilePath);
  }

  console.log(`[DEBUG] Processing ${docs.length} pages from PDF`);

  // Create documents for each page
  const documents = docs.map((doc, index) => {
    console.log(`[DEBUG] Processing page ${index + 1} of ${docs.length}`);
    console.log(`[DEBUG] Page number from metadata: ${doc.metadata?.loc?.pageNumber}`);
    console.log(`[DEBUG] Content length: ${doc.pageContent.length}`);

    const data = {
      id: v4(),
      url: 'custom-documents/' + filename,
      title: filename,
      docAuthor: doc?.metadata?.pdf?.info?.Creator || "no author found",
      description: doc?.metadata?.pdf?.info?.Title || "No description found.",
      docSource: "pdf file uploaded by the user.",
      chunkSource: "",
      published: createdDate(fullFilePath),
      wordCount: doc.pageContent.split(" ").length,
      pageContent: doc.pageContent,
      token_count_estimate: tokenizeString(doc.pageContent),
      loc_pageNumber: doc.metadata?.loc?.pageNumber || null,
      metadata_pdf_version: doc?.metadata?.pdf?.version || null,
      metadata_pdf_total_pages: doc?.metadata?.pdf?.totalPages || null,
      metadata_pdf_creator: doc?.metadata?.pdf?.info?.Creator || null,
      metadata_pdf_title: doc?.metadata?.pdf?.info?.Title || null,
      metadata_pdf_author: doc?.metadata?.pdf?.info?.Author || null,
      metadata_pdf_subject: doc?.metadata?.pdf?.info?.Subject || null,
      metadata_pdf_keywords: doc?.metadata?.pdf?.info?.Keywords || null,
      metadata_pdf_producer: doc?.metadata?.pdf?.info?.Producer || null,
      metadata_pdf_creation_date: doc?.metadata?.pdf?.info?.CreationDate || null,
      metadata_pdf_modification_date: doc?.metadata?.pdf?.info?.ModDate || null
    };

    console.log(`[DEBUG] Created document with page number: ${data.loc_pageNumber}`);
    // Create a unique filename for each document using the page number
    const uniqueFilename = `${filename}-page-${data.loc_pageNumber || index + 1}-${data.id}`;
    return writeToServerDocuments(data, uniqueFilename);
  });

  console.log(`[DEBUG] Total documents created: ${documents.length}`);
  trashFile(fullFilePath);
  console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
  return { success: true, reason: null, documents };
}

module.exports = asPdf;
