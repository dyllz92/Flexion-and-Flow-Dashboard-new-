import React from 'react';

const SoapNotes: React.FC = () => {
  return (
    <div className="w-full h-[calc(100vh-120px)] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <iframe 
        src="/soap-notes.html" 
        className="w-full h-full border-0"
        title="SOAP Note Generator"
      />
    </div>
  );
};

export default SoapNotes;

