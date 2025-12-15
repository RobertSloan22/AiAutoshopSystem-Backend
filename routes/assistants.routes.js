import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import {
  createAssistant,
  listAssistants,
  getAssistant,
  updateAssistant,
  deleteAssistant,
  createThread,
  addMessage,
  getMessages,
  createRun,
  getRun,
  submitToolOutputs,
  cancelRun,
  createThreadAndRun
} from '../controllers/assistants.controller.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supported file types for vector stores
const SUPPORTED_FILE_TYPES = [
  '.txt', '.md', '.pdf', '.html', '.json', '.jsonl',
  '.csv', '.xml', '.tex', '.docx', '.pptx', '.xlsx',
  '.py', '.js', '.java', '.c', '.cpp', '.cs', '.php',
  '.rb', '.go', '.rs', '.kt', '.swift', '.m', '.scala',
  '.sh', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.log'
];

// Helper function to check if file type is supported
const isSupportedFileType = (filename) => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SUPPORTED_FILE_TYPES.includes(ext);
};

// Helper function to get or create vector store for a specific assistant
const getOrCreateVectorStore = async (assistantId) => {
  if (!assistantId || !assistantId.startsWith('asst_')) {
    throw new Error(`Invalid assistant ID: ${assistantId}. Expected ID starting with "asst_"`);
  }
  
  try {
    const assistant = await openai.beta.assistants.retrieve(assistantId);

    // If assistant already has a vector store, return it
    if (assistant.tool_resources?.file_search?.vector_store_ids?.length > 0) {
      return assistant.tool_resources.file_search.vector_store_ids[0];
    }

    // Create a new vector store
    const vectorStore = await openai.vectorStores.create({
      name: 'assistant-vector-store',
    });

    // Update the assistant with the new vector store
    await openai.beta.assistants.update(assistantId, {
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStore.id],
        },
      },
    });

    return vectorStore.id;
  } catch (error) {
    console.error('Error in getOrCreateVectorStore:', error);
    throw error;
  }
};

// Assistant routes
router.post('/', createAssistant);
router.get('/', listAssistants);
router.get('/:assistantId', getAssistant);
router.put('/:assistantId', updateAssistant);
router.delete('/:assistantId', deleteAssistant);

// Thread routes
router.post('/threads', createThread);
router.post('/threads/:threadId/messages', addMessage);
router.get('/threads/:threadId/messages', getMessages);

// Run routes
router.post('/threads/:threadId/runs', createRun);
router.get('/threads/:threadId/runs/:runId', getRun);
router.post('/threads/:threadId/runs/:runId/submit-tool-outputs', submitToolOutputs);
router.post('/threads/:threadId/runs/:runId/cancel', cancelRun);

// Thread and run creation (combined operation)
router.post('/thread-runs', createThreadAndRun);

// File management routes
// Upload file to assistant's vector store
router.post('/:assistantId/files', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Log file details for debugging
    console.log('Uploading file:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Check if file type is supported
    if (!isSupportedFileType(req.file.originalname)) {
      fs.unlinkSync(req.file.path);
      const ext = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
      return res.status(400).json({ 
        error: `File type ${ext} is not supported. Supported types: ${SUPPORTED_FILE_TYPES.join(', ')}`
      });
    }

    const { assistantId } = req.params;
    const vectorStoreId = await getOrCreateVectorStore(assistantId);

    // Create a readable stream from the uploaded file
    const fileStream = fs.createReadStream(req.file.path);

    // Upload file to OpenAI with assistants purpose for vector store usage
    const openaiFile = await openai.files.create({
      file: fileStream,
      purpose: 'assistants',  // Use 'assistants' for files that will be added to vector stores
    });
    
    console.log('OpenAI file created:', openaiFile.id);

    // Add file to vector store
    console.log('Adding file to vector store:', vectorStoreId);
    const vectorFile = await openai.vectorStores.files.createAndPoll(vectorStoreId, {
      file_id: openaiFile.id,
    });
    console.log('File added to vector store:', vectorFile);

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
router.get('/:assistantId/files', async (req, res) => {
  try {
    const { assistantId } = req.params;
    const vectorStoreId = await getOrCreateVectorStore(assistantId);
    const fileList = await openai.vectorStores.files.list(vectorStoreId);

    const filesArray = await Promise.all(
      fileList.data.map(async (file) => {
        const fileDetails = await openai.files.retrieve(file.id);
        const vectorFileDetails = await openai.vectorStores.files.retrieve(
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
router.delete('/:assistantId/files/:fileId', async (req, res) => {
  try {
    const { assistantId, fileId } = req.params;
    const vectorStoreId = await getOrCreateVectorStore(assistantId);

    await openai.vectorStores.files.del(vectorStoreId, fileId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload multiple files
router.post('/:assistantId/files/bulk', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const { assistantId } = req.params;
    const vectorStoreId = await getOrCreateVectorStore(assistantId);
    const uploadedFiles = [];

    for (const file of req.files) {
      try {
        // Check if file type is supported
        if (!isSupportedFileType(file.originalname)) {
          console.log(`Skipping unsupported file type: ${file.originalname}`);
          fs.unlinkSync(file.path);
          continue;
        }

        const fileStream = fs.createReadStream(file.path);

        const openaiFile = await openai.files.create({
          file: fileStream,
          purpose: 'assistants',  // Use 'assistants' for files that will be added to vector stores
        });

        await openai.vectorStores.files.createAndPoll(vectorStoreId, {
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