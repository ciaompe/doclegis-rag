const { Document } = require("../models/documents");
const { normalizePath, documentsPath, isWithin } = require("../utils/files");
const { reqBody } = require("../utils/http");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const fs = require("fs");
const path = require("path");

function documentEndpoints(app) {
  if (!app) return;
  app.post(
    "/document/create-folder",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { name } = reqBody(request);
        const storagePath = path.join(documentsPath, normalizePath(name));
        if (!isWithin(path.resolve(documentsPath), path.resolve(storagePath)))
          throw new Error("Invalid folder name.");

        if (fs.existsSync(storagePath)) {
          response.status(500).json({
            success: false,
            message: "Folder by that name already exists",
          });
          return;
        }

        fs.mkdirSync(storagePath, { recursive: true });
        response.status(200).json({ success: true, message: null });
      } catch (e) {
        console.error(e);
        response.status(500).json({
          success: false,
          message: `Failed to create folder: ${e.message} `,
        });
      }
    }
  );

  app.post(
    "/document/move-files",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { files } = reqBody(request);
        const docpaths = files.map(({ from }) => from);
        const documents = await Document.where({ docpath: { in: docpaths } });

        const embeddedFiles = documents.map((doc) => doc.docpath);
        const moveableFiles = files.filter(
          ({ from }) => !embeddedFiles.includes(from)
        );

        const movePromises = moveableFiles.map(({ from, to }) => {
          const sourcePath = path.join(documentsPath, normalizePath(from));
          const destinationPath = path.join(documentsPath, normalizePath(to));

          return new Promise((resolve, reject) => {
            if (
              !isWithin(documentsPath, sourcePath) ||
              !isWithin(documentsPath, destinationPath)
            )
              return reject("Invalid file location");

            fs.rename(sourcePath, destinationPath, (err) => {
              if (err) {
                console.error(`Error moving file ${from} to ${to}:`, err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        });

        Promise.all(movePromises)
          .then(() => {
            const unmovableCount = files.length - moveableFiles.length;
            if (unmovableCount > 0) {
              response.status(200).json({
                success: true,
                message: `${unmovableCount}/${files.length} files not moved. Unembed them from all workspaces.`,
              });
            } else {
              response.status(200).json({
                success: true,
                message: null,
              });
            }
          })
          .catch((err) => {
            console.error("Error moving files:", err);
            response
              .status(500)
              .json({ success: false, message: "Failed to move some files." });
          });
      } catch (e) {
        console.error(e);
        response
          .status(500)
          .json({ success: false, message: "Failed to move files." });
      }
    }
  );

  //download file from the storage and need to get the file name as parameter
  app.post("/document/download/", async (request, response) => {
    const { docpath } = reqBody(request);
    if (!docpath) {
      response.status(500).json({
        success: false,
        message: "Invalid file path.",
      });
      return;
    }
    const storagePath = path.join(documentsPath, normalizePath(docpath));
    if (!isWithin(documentsPath, storagePath)) {
      response.status(500).json({
        success: false,
        message: "Invalid file path.",
      });
      return;
    }
    response.download(storagePath);
  });

  // View file from storage
  app.get("/document/view", async (request, response) => {
    try {
      const { docpath } = request.query;
      if (!docpath) {
        response.status(400).json({
          success: false,
          message: "Document path is required",
        });
        return;
      }

      const storagePath = path.join(documentsPath, normalizePath(docpath));
      if (!isWithin(documentsPath, storagePath)) {
        response.status(403).json({
          success: false,
          message: "Invalid file path",
        });
        return;
      }

      if (!fs.existsSync(storagePath)) {
        response.status(404).json({
          success: false,
          message: "File not found",
        });
        return;
      }

      // Get file extension and set appropriate content type
      const ext = path.extname(storagePath).toLowerCase();
      const contentType = {
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.json': 'application/json',
        '.html': 'text/html',
        '.md': 'text/markdown',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
      }[ext] || 'application/octet-stream';

      // Set headers for file preview
      response.setHeader('Content-Type', contentType);
      response.setHeader('Content-Disposition', `inline; filename="${path.basename(storagePath)}"`);
      
      // Stream the file
      const fileStream = fs.createReadStream(storagePath);
      fileStream.pipe(response);
      
      fileStream.on('error', (error) => {
        console.error('Error streaming file:', error);
        response.status(500).json({
          success: false,
          message: "Error reading file",
        });
      });

    } catch (error) {
      console.error('Error in document view:', error);
      response.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });
}

module.exports = { documentEndpoints };
