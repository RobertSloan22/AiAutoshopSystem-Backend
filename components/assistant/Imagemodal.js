import React from 'react';
import { X } from 'lucide-react';
export var Imagemodal = function (_a) {
    var open = _a.open, onClose = _a.onClose, children = _a.children;
    if (!open)
        return null;
    return (<div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
            <div className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <X size={24}/>
                </button>
                {children}
            </div>
        </div>);
};
