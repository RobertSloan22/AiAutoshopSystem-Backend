import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  Upload, 
  Bot, 
  ChevronRight, 
  Check, 
  RefreshCw,
  Plus,
  FileText,
  Settings,
  Play
} from 'lucide-react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import EnhancedChat from './EnhancedChat';

interface FileItem {
  file_id: string;  // Changed from 'id' to 'file_id' to match backend
  filename: string;
  status: string;
  created_at?: number;
}

interface Assistant {
  id: string;
  name: string;
  description?: string;
  model: string;
  instructions?: string;
  tools?: any[];
  tool_resources?: {
    file_search?: {
      vector_store_ids: string[];
    };
  };
}

interface UnifiedKnowledgeBaseAssistantProps {
  onClose?: () => void;
}

type Step = 'assistant' | 'upload' | 'chat';

export default function UnifiedKnowledgeBaseAssistant({ 
  onClose 
}: UnifiedKnowledgeBaseAssistantProps) {
  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('assistant');
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());

  // Assistant state
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const [isCreatingAssistant, setIsCreatingAssistant] = useState(false);
  const [newAssistantName, setNewAssistantName] = useState('');
  const [newAssistantInstructions, setNewAssistantInstructions] = useState('You are a helpful automotive diagnostic assistant. Use the knowledge base files to provide accurate information about vehicle repairs and troubleshooting.');

  // File state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchAssistants();
  }, []);

  const fetchAssistants = async () => {
    try {
      setIsLoadingAssistants(true);
      // Fixed API endpoint - removed '/openai' from path
      const response = await axiosInstance.get('/api/assistants');
      console.log('Fetch assistants response:', response.data);
      
      if (response.data) {
        // Handle both direct array and nested data structure
        const assistantList = Array.isArray(response.data) ? response.data : response.data.data || [];
        setAssistants(assistantList);
      }
    } catch (error: any) {
      console.error('Error fetching assistants:', error);
      toast.error(`Failed to load assistants: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsLoadingAssistants(false);
    }
  };

  const createAssistant = async () => {
    if (!newAssistantName.trim()) {
      toast.error('Please enter a name for the assistant');
      return;
    }

    try {
      setIsCreatingAssistant(true);
      
      const requestPayload = {
        name: newAssistantName.trim(),
        instructions: newAssistantInstructions.trim(),
        model: 'gpt-4-turbo-preview',
        tools: [{ type: 'file_search' }]
      };
      
      console.log('Creating assistant with payload:', requestPayload);
      
      // Fixed API endpoint
      const response = await axiosInstance.post('/api/assistants', requestPayload);
      console.log('Create assistant response:', response.data);

      if (response.data && !response.data.error) {
        const newAssistant: Assistant = response.data;
        setAssistants([...assistants, newAssistant]);
        setNewAssistantName('');
        toast.success(`Created assistant "${newAssistant.name}" with ID: ${newAssistant.id}`);
      } else {
        const errorMessage = response.data?.error || response.data?.message || 'Failed to create assistant';
        console.error('Assistant creation failed:', response.data);
        toast.error(`Assistant creation failed: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('Error creating assistant:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      toast.error(`Failed to create assistant: ${errorMsg}`);
    } finally {
      setIsCreatingAssistant(false);
    }
  };

  const validateFile = (file: File): boolean => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (file.size > maxSize) {
      toast.error(`File ${file.name} is too large. Maximum size is 50MB.`);
      return false;
    }

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|md|js|py|json|xml|html|css)$/i)) {
      toast.error(`File ${file.name} has unsupported format.`);
      return false;
    }

    return true;
  };

  const handleFileUpload = async (uploadedFiles: File[]) => {
    if (!selectedAssistant?.id) {
      toast.error('Please select an assistant first');
      return;
    }

    console.log('Uploading files for assistant:', selectedAssistant.id, selectedAssistant.name);

    // Validate assistant ID format
    if (!selectedAssistant.id.startsWith('asst_')) {
      toast.error(`Invalid assistant ID format: ${selectedAssistant.id}. Expected ID starting with 'asst_'`);
      return;
    }

    // Validate all files first
    const validFiles = uploadedFiles.filter(validateFile);
    if (validFiles.length === 0) {
      return;
    }

    if (validFiles.length !== uploadedFiles.length) {
      toast.error(`${uploadedFiles.length - validFiles.length} file(s) were skipped due to validation errors.`);
    }

    try {
      setIsUploading(true);
      toast.loading(`Uploading ${validFiles.length} file(s)...`, { id: 'file-upload' });

      const newFiles: FileItem[] = [];

      if (validFiles.length === 1) {
        // Single file upload
        const file = validFiles[0];
        try {
          const formData = new FormData();
          formData.append('file', file);
          // Removed assistant_id from formData - backend uses environment variable

          console.log('Uploading single file:', file.name);

          // Fixed API endpoint
          const uploadResponse = await axiosInstance.post('/api/assistants/files', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            }
          });

          console.log('Upload response:', uploadResponse.data);

          if (uploadResponse.data && uploadResponse.data.success) {
            newFiles.push({
              file_id: uploadResponse.data.fileId,
              filename: uploadResponse.data.filename || file.name,
              status: 'completed',
              created_at: Date.now() / 1000
            });
          }
        } catch (fileError: any) {
          console.error(`Error uploading ${file.name}:`, fileError);
          toast.error(`Failed to upload ${file.name}: ${fileError.response?.data?.error || fileError.message}`);
        }
      } else {
        // Multiple files upload
        const formData = new FormData();
        validFiles.forEach((file) => {
          formData.append('files', file);
        });

        console.log('Uploading multiple files:', validFiles.map(f => f.name));

        // Fixed API endpoint for bulk upload
        const uploadResponse = await axiosInstance.post('/api/assistants/files/bulk', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });

        console.log('Bulk upload response:', uploadResponse.data);

        if (uploadResponse.data && uploadResponse.data.success && uploadResponse.data.files) {
          uploadResponse.data.files.forEach((fileData: any) => {
            newFiles.push({
              file_id: fileData.fileId,
              filename: fileData.filename,
              status: 'completed',
              created_at: Date.now() / 1000
            });
          });
        }
      }

      if (newFiles.length > 0) {
        setFiles(prev => [...prev, ...newFiles]);
        toast.dismiss('file-upload');
        toast.success(`Successfully uploaded ${newFiles.length} file(s)`);

        // Mark upload step as completed and move to chat
        setCompletedSteps(prev => new Set([...prev, 'upload']));
        setCurrentStep('chat');
      } else {
        toast.dismiss('file-upload');
        toast.error('No files were uploaded successfully');
      }

    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast.dismiss('file-upload');
      toast.error(`Upload failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const selectAssistant = (assistant: Assistant) => {
    setSelectedAssistant(assistant);
    setCompletedSteps(prev => new Set([...prev, 'assistant']));
    
    // Fetch existing files for this assistant
    fetchAssistantFiles(assistant.id);
    setCurrentStep('upload');
  };

  const fetchAssistantFiles = async (assistantId: string) => {
    try {
      console.log('Fetching files for assistant:', assistantId);
      // Fixed API endpoint - backend doesn't need assistant_id param since it uses env variable
      const response = await axiosInstance.get('/api/assistants/files');
      console.log('Fetch files response:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        // Map the response to match our FileItem interface
        const fileList = response.data.map((file: any) => ({
          file_id: file.file_id,
          filename: file.filename,
          status: file.status || 'completed',
          created_at: file.created_at
        }));
        
        setFiles(fileList);
        if (fileList.length > 0) {
          setCompletedSteps(prev => new Set([...prev, 'upload']));
        }
      }
    } catch (error: any) {
      console.error('Error fetching assistant files:', error);
      // Don't show error toast for file fetching - it's not critical
      console.warn('Could not fetch existing files, continuing with empty list');
    }
  };

  const steps = [
    { id: 'assistant' as Step, title: 'AI Assistant', icon: Bot },
    { id: 'upload' as Step, title: 'Upload Files', icon: Upload },
    { id: 'chat' as Step, title: 'Chat', icon: MessageSquare }
  ];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 p-4 bg-gray-800/40 border-b border-gray-600/60">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = currentStep === step.id;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isCurrent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                {isCompleted ? (
                  <Check size={16} />
                ) : (
                  <Icon size={16} />
                )}
              </div>
              <span
                className={`text-sm font-medium transition-all duration-200 ${
                  isCompleted
                    ? 'text-green-400'
                    : isCurrent
                    ? 'text-blue-400'
                    : 'text-gray-500'
                }`}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight
                size={16}
                className={`transition-all duration-200 ${
                  completedSteps.has(steps[index + 1].id)
                    ? 'text-green-400'
                    : 'text-gray-500'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderAssistantStep = () => (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <Bot size={48} className="text-blue-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Choose Your AI Assistant</h2>
        <p className="text-gray-400">
          {selectedAssistant 
            ? `Selected: ${selectedAssistant.name}` 
            : 'Select an existing assistant or create a new one'
          }
        </p>
      </div>

      {/* Existing Assistants */}
      {isLoadingAssistants ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : assistants.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Existing Assistants</h3>
          <div className="grid gap-3">
            {assistants.map((assistant) => (
              <div
                key={assistant.id}
                onClick={() => selectAssistant(assistant)}
                className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:scale-105 ${
                  selectedAssistant?.id === assistant.id
                    ? 'bg-blue-600/20 border-blue-400 shadow-lg ring-2 ring-blue-400/50'
                    : 'bg-gray-800/60 border-gray-600/60 hover:bg-gray-700/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-white">{assistant.name}</h4>
                      {selectedAssistant?.id === assistant.id && (
                        <Check size={16} className="text-green-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{assistant.model}</p>
                    <p className="text-xs text-gray-500">ID: {assistant.id?.substring(0, 12)}...</p>
                  </div>
                  <Bot size={20} className={selectedAssistant?.id === assistant.id ? "text-blue-300" : "text-blue-400"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Create New Assistant */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-300">Create New Assistant</h3>
        <div className="bg-gray-800/60 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Assistant Name *
            </label>
            <input
              type="text"
              value={newAssistantName}
              onChange={(e) => setNewAssistantName(e.target.value)}
              placeholder="e.g., Vehicle Diagnostic Assistant"
              className="w-full px-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Instructions
            </label>
            <textarea
              value={newAssistantInstructions}
              onChange={(e) => setNewAssistantInstructions(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            />
          </div>

          <button
            onClick={createAssistant}
            disabled={!newAssistantName.trim() || isCreatingAssistant}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all duration-200"
          >
            {isCreatingAssistant ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            <span>{isCreatingAssistant ? 'Creating...' : 'Create Assistant'}</span>
          </button>
        </div>
      </div>

      {/* Continue Button */}
      {selectedAssistant && (
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setCompletedSteps(prev => new Set([...prev, 'assistant']));
              setCurrentStep('upload');
            }}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 flex items-center space-x-2 mx-auto"
          >
            <span>Continue with {selectedAssistant.name}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      handleFileUpload(files);
    }
  };

  const renderUploadStep = () => {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <Upload size={48} className="text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Upload Documents</h2>
          <p className="text-gray-400">
            Add documents to your assistant: {selectedAssistant?.name}
          </p>
        </div>

        {/* File Upload Area */}
        <div 
          className={`bg-gray-800/60 rounded-lg border-2 border-dashed p-8 transition-all duration-200 ${
            dragActive 
              ? 'border-blue-400 bg-blue-900/20' 
              : 'border-gray-600/60 hover:border-gray-500/60'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <FileText size={32} className={`mx-auto mb-4 transition-colors duration-200 ${
              dragActive ? 'text-blue-400' : 'text-gray-400'
            }`} />
            <h3 className="text-lg font-medium text-white mb-2">
              {dragActive ? 'Drop Files Here' : 'Drag & Drop Files Here'}
            </h3>
            <p className="text-gray-400 mb-4">
              Or click to browse files (PDF, TXT, MD, DOCX, XLSX, CSV, JS, PY, etc.)
            </p>
            
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.docx,.xlsx,.csv,.js,.py,.json,.xml,.html,.css"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                  handleFileUpload(files);
                }
                // Reset the input so the same file can be selected again
                e.target.value = '';
              }}
              className="hidden"
              id="file-upload"
            />
            
            <label
              htmlFor="file-upload"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-all duration-200"
            >
              <Upload size={16} />
              <span>Choose Files</span>
            </label>
          </div>
        </div>

        {/* Uploaded Files */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">
              Uploaded Files ({files.length})
            </h3>
            <div className="bg-gray-800/60 rounded-lg p-4 max-h-40 overflow-auto">
              {files.map((file) => (
                <div key={file.file_id} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-2">
                    <FileText size={16} className="text-blue-400" />
                    <span className="text-white text-sm">{file.filename}</span>
                  </div>
                  <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
                    {file.status}
                  </span>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => {
                setCompletedSteps(prev => new Set([...prev, 'upload']));
                setCurrentStep('chat');
              }}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center space-x-2 transition-all duration-200"
            >
              <Play size={16} />
              <span>Start Chatting</span>
            </button>
          </div>
        )}

        {isUploading && (
          <div className="flex items-center justify-center space-x-2 py-4">
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-gray-400">Uploading files...</span>
          </div>
        )}
      </div>
    );
  };

  const renderChatStep = () => {
    console.log('Rendering chat with assistant ID:', selectedAssistant?.id, 'and files:', files.length);
    
    if (!selectedAssistant?.id) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <Bot size={48} className="text-red-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Assistant Selected</h3>
            <p className="text-gray-400">Please go back and select an assistant first.</p>
            <button
              onClick={() => setCurrentStep('assistant')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-200"
            >
              Go Back to Assistant Selection
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="h-full">
        <EnhancedChat 
          files={files} 
          assistantId={selectedAssistant.id} 
        />
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-600/60 p-4 bg-gradient-to-r from-gray-800/60 to-gray-700/40 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings size={20} className="text-blue-400" />
            <div>
              <h1 className="text-lg font-bold text-white">Knowledge Base Setup</h1>
              {selectedAssistant && selectedAssistant.id && (
                <p className="text-xs text-gray-400">
                  Assistant: {selectedAssistant.name} ({selectedAssistant.id.substring(0, 12)}...)
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {currentStep === 'assistant' && renderAssistantStep()}
        {currentStep === 'upload' && renderUploadStep()}
        {currentStep === 'chat' && renderChatStep()}
      </div>

      {/* Navigation */}
      {currentStep !== 'chat' && (
        <div className="border-t border-gray-600/60 p-4 bg-gray-800/40">
          <div className="flex justify-between">
            <button
              onClick={() => {
                const stepIndex = steps.findIndex(s => s.id === currentStep);
                if (stepIndex > 0) {
                  setCurrentStep(steps[stepIndex - 1].id);
                }
              }}
              disabled={currentStep === 'assistant'}
              className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Previous
            </button>
            
            <button
              onClick={() => {
                const stepIndex = steps.findIndex(s => s.id === currentStep);
                if (stepIndex < steps.length - 1) {
                  if (currentStep === 'assistant' && selectedAssistant) {
                    setCompletedSteps(prev => new Set([...prev, 'assistant']));
                  }
                  setCurrentStep(steps[stepIndex + 1].id);
                }
              }}
              disabled={
                (currentStep === 'assistant' && !selectedAssistant?.id) ||
                (currentStep === 'upload' && files.length === 0)
              }
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}