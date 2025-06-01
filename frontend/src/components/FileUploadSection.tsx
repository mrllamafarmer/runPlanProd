import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, TestTube } from 'lucide-react';

interface FileUploadSectionProps {
  onFileUpload: (file: File) => void;
  onSampleData: () => void;
  isLoading: boolean;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  onFileUpload,
  onSampleData,
  isLoading,
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/gpx+xml': ['.gpx'],
      'application/xml': ['.gpx'],
      'text/xml': ['.gpx'],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  const dropzoneClasses = [
    'border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer',
    isDragActive && !isDragReject ? 'drag-active' : '',
    isDragReject ? 'drag-reject' : '',
    !isDragActive ? 'border-gray-300 hover:border-primary-400 hover:bg-primary-50' : '',
    isLoading ? 'opacity-50 cursor-not-allowed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      <div {...getRootProps()} className={dropzoneClasses}>
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Upload GPX File
        </h3>
        {isDragActive ? (
          <p className="text-primary-600">
            Drop your GPX file here...
          </p>
        ) : (
          <div>
            <p className="text-gray-600 mb-4">
              Drag and drop your GPX file here, or click to browse
            </p>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                disabled={isLoading}
                className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                📁 Choose GPX File
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSampleData();
                }}
                disabled={isLoading}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <TestTube className="h-4 w-4" />
                Test with Sample Data
              </button>
            </div>
          </div>
        )}
        <p className="text-sm text-gray-500 mt-4">
          Supports .gpx files from GPS devices, running apps, and mapping software
        </p>
      </div>
      
      {isLoading && (
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          <p className="text-sm text-gray-600 mt-2">Processing file...</p>
        </div>
      )}
    </div>
  );
};

export default FileUploadSection; 