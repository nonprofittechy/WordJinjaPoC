import React from 'react';

export const Header: React.FC = () => {
    return (
        <header className="bg-gray-800 shadow-lg p-4">
            <div className="container mx-auto flex items-center gap-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
                <h1 className="text-2xl font-bold text-white tracking-wider">
                    DOCX Jinja2 Labeler
                </h1>
            </div>
        </header>
    );
};
