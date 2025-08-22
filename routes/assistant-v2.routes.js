import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = process.env.OPENAI_ASSISTANT_ID || 'your-assistant-id-here';

// Helper function to get or create vector store
const getOrCreateVectorStore = async () => {
  const assistant = await openai.beta.assistants.retrieve(assistantId);

  // If assistant already has a vector store, return it
  if (assistant.tool_resources?.file_search?.vector_store_ids?.length > 0) {
    return assistant.tool_resources.file_search.vector_store_ids[0];
  }

  // Otherwise, create a new vector store and attach it to the assistant
  const vectorStore = await openai.beta.vectorStores.create({
    name: 'assistant-vector-store',
  });

  await openai.beta.assistants.update(assistantId, {
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStore.id],
      },
    },
  });

  return vectorStore.id;
};

// Upload file to assistant's vector store
router.post('/files', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const vectorStoreId = await getOrCreateVectorStore();

    // Create a readable stream from the uploaded file
    const fileStream = fs.createReadStream(req.file.path);

    // Upload file to OpenAI
    const openaiFile = await openai.files.create({
      file: fileStream,
      purpose: 'assistants',
    });

    // Add file to vector store
    await openai.beta.vectorStores.files.create(vectorStoreId, {
      file_id: openaiFile.id,
    });

    // Clean up the temporary file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      fileId: openaiFile.id,
      filename: req.file.originalname,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    // Clean up the temporary file in case of error
    if (req.file?.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// List files in assistant's vector store
router.get('/files', async (req, res) => {
  try {
    const vectorStoreId = await getOrCreateVectorStore();
    const fileList = await openai.beta.vectorStores.files.list(vectorStoreId);

    const filesArray = await Promise.all(
      fileList.data.map(async (file) => {
        const fileDetails = await openai.files.retrieve(file.id);
        const vectorFileDetails = await openai.beta.vectorStores.files.retrieve(
          vectorStoreId,
          file.id
        );
        return {
          file_id: file.id,
          filename: fileDetails.filename,
          status: vectorFileDetails.status,
        };
      })
    );

    res.json(filesArray);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete file from assistant's vector store
router.delete('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const vectorStoreId = await getOrCreateVectorStore();

    await openai.beta.vectorStores.files.del(vectorStoreId, fileId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload multiple files
router.post('/files/bulk', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const vectorStoreId = await getOrCreateVectorStore();
    const uploadedFiles = [];

    for (const file of req.files) {
      try {
        const fileStream = fs.createReadStream(file.path);

        const openaiFile = await openai.files.create({
          file: fileStream,
          purpose: 'assistants',
        });

        await openai.beta.vectorStores.files.create(vectorStoreId, {
          file_id: openaiFile.id,
        });

        uploadedFiles.push({
          fileId: openaiFile.id,
          filename: file.originalname,
        });

        // Clean up the temporary file
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error(`Error uploading file ${file.originalname}:`, error);
        // Clean up the temporary file even if upload fails
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    res.status(200).json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    // Clean up any remaining temporary files
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
