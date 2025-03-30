import React, { ReactNode, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';

interface SearchResult {
    title: string;
    link: string;
    source: string;
    thumbnail: string;
  }
  
  interface ImageSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    searchResults: SearchResult[];
    onSelectImage: (image: SearchResult) => void;
    onSaveImage?: (image: SearchResult) => Promise<void>;
  }
  
  export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
    isOpen,
    onClose,
    searchResults,
    onSelectImage,
    onSaveImage
  }) => {
    if (!isOpen) return null;
  
    const handleImageSelect = async (result: SearchResult) => {
      try {
        if (onSaveImage) {
          await onSaveImage(result);
        }
        onSelectImage(result);
      } catch (error) {
        console.error('Error saving image:', error);
      }
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg w-[80vw] max-w-4xl max-h-[80vh] overflow-hidden border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Search Results</h2>
            <button onClick={onClose} className="text-white hover:text-white">
              ✕
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(80vh-100px)]">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {searchResults.map((result, index) => (
                <div 
                  key={index}
                  className="border border-gray-700 rounded-lg p-2 cursor-pointer hover:border-blue-500 bg-gray-800 bg-opacity-50"
                  onClick={() => handleImageSelect(result)}
                >
                  <img 
                    src={result.link} 
                    alt={result.title}
                    className="w-full h-full "
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = result.thumbnail;
                    }}
                  />
                  <p className="text-xl text-white truncate">{result.title}</p>
                  <p className="text-xl text-white truncate">Source: {result.source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

interface ImagemodalProps {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  explanation?: string;
  isLoadingExplanation?: boolean;
  followUpQuestion?: string;
  followUpAnswer?: string;
  isAskingFollowUp?: boolean;
  onAskFollowUp?: (question: string) => void;
  onFollowUpChange?: (question: string) => void;
}

export const Imagemodal: React.FC<ImagemodalProps> = ({
  children,
  open,
  onClose,
  explanation,
  isLoadingExplanation,
  followUpQuestion = '',
  followUpAnswer = '',
  isAskingFollowUp = false,
  onAskFollowUp,
  onFollowUpChange,
}) => {
  const [showExplanation, setShowExplanation] = useState(true);
  const [questionHistory, setQuestionHistory] = useState<Array<{question: string, answer: string}>>([]);

  // Update question history when a new answer comes in
  React.useEffect(() => {
    if (followUpQuestion && followUpAnswer && !isAskingFollowUp) {
      console.log('Adding to question history:', { 
        question: followUpQuestion, 
        answer: followUpAnswer 
      });
      
      setQuestionHistory(prev => [
        ...prev, 
        { question: followUpQuestion, answer: followUpAnswer }
      ]);
    }
  }, [followUpAnswer, followUpQuestion, isAskingFollowUp]);

  if (!open) return null;

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submit question:', followUpQuestion);
    if (onAskFollowUp && followUpQuestion.trim()) {
      onAskFollowUp(followUpQuestion);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row items-center justify-center bg-black bg-opacity-90 p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
      >
        <X size={32} />
      </button>

      {/* Left side - Image */}
      <div className="w-full md:w-2/3 h-1/2 md:h-full relative flex items-center justify-center">
        {children}
      </div>

      {/* Right side - Explanation and follow-up questions */}
      <div className="w-full md:w-1/3 h-1/2 md:h-full flex flex-col bg-gray-900 p-4 overflow-y-auto">
        {/* Tabs */}
        <div className="flex mb-4 border-b border-gray-800">
          <button 
            className={`px-4 py-2 ${showExplanation ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
            onClick={() => setShowExplanation(true)}
          >
            Explanation
          </button>
          <button 
            className={`px-4 py-2 ${!showExplanation ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
            onClick={() => setShowExplanation(false)}
          >
            Ask Questions
          </button>
        </div>

        {/* Content */}
        {showExplanation ? (
          <div className="flex-1 overflow-y-auto">
            <h3 className="text-2xl font-bold text-blue-400 mb-4">Image Explanation</h3>
            {isLoadingExplanation ? (
              <div className="animate-pulse flex flex-col space-y-4">
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded w-4/6"></div>
              </div>
            ) : (
              <div className="text-white text-2xl whitespace-pre-wrap">{explanation}</div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <h3 className="text-2xl font-bold text-blue-400 mb-4">Ask About This Image</h3>
            
            {/* Question input */}
            <form onSubmit={handleSubmitQuestion} className="mb-4">
              <div className="flex">
                <input
                  type="text"
                  value={followUpQuestion}
                  onChange={(e) => onFollowUpChange?.(e.target.value)}
                  placeholder="Ask a question about this image..."
                  className="flex-1 bg-gray-800 text-white text-xl p-3 rounded-l-lg border border-gray-700 focus:outline-none focus:border-blue-500"
                  disabled={isAskingFollowUp}
                />
                <button
                  type="submit"
                  disabled={isAskingFollowUp || !followUpQuestion.trim()}
                  className="bg-blue-600 text-white p-3 rounded-r-lg hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
                >
                  <ArrowRight size={24} />
                </button>
              </div>
            </form>
            
            {/* Answer display - Show history of all questions */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Show current question/answer if still in progress */}
              {(followUpQuestion && (followUpAnswer || isAskingFollowUp)) && (
                <div className="bg-gray-800 rounded-lg p-4 mb-4">
                  <div className="text-blue-400 text-xl mb-2">Your question:</div>
                  <div className="text-white text-xl mb-4">{followUpQuestion}</div>
                  
                  {isAskingFollowUp ? (
                    <div className="text-center py-4">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      <p className="text-blue-400 mt-2">Getting your answer...</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-green-400 text-xl mb-2">Answer:</div>
                      <div className="text-white text-xl whitespace-pre-wrap">{followUpAnswer}</div>
                    </>
                  )}
                </div>
              )}
              
              {/* Show history of previous questions */}
              {questionHistory.length > 0 && (
                <>
                  <h4 className="text-xl font-semibold text-blue-400 mt-8 mb-2">Previous Questions</h4>
                  {questionHistory.map((item, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-4">
                      <div className="text-blue-400 text-xl mb-2">Q: {item.question}</div>
                      <div className="text-green-400 text-xl mb-2">A:</div>
                      <div className="text-white text-xl whitespace-pre-wrap">{item.answer}</div>
                    </div>
                  ))}
                </>
              )}
              
              {/* Show suggestions if no questions asked yet */}
              {!followUpAnswer && !isAskingFollowUp && questionHistory.length === 0 && (
                <div className="text-gray-400 text-center py-8 flex-1 flex items-center justify-center">
                  <div>
                    <p className="text-xl mb-2">Ask any question about the image</p>
                    <p className="text-lg">Examples:</p>
                    <ul className="list-disc list-inside text-gray-500">
                      <li>What are the common failures for this part?</li>
                      <li>How does this component connect to the system?</li>
                      <li>What tools do I need to service this?</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


