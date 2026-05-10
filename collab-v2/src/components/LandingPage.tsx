import React, { useState } from "react";
import "../styles/landing.css";

interface LandingPageProps {
  onCreateDocument: (creatorName: string, documentTitle: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onCreateDocument }) => {
  const [creatorName, setCreatorName] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorName.trim() || !documentTitle.trim()) return;
    
    setIsSubmitting(true);
    onCreateDocument(creatorName.trim(), documentTitle.trim());
  };

  return (
    <div className="landing-container">
      <div className="landing-card">
        <div className="landing-header">
          <h1 className="landing-title">Collab Docs</h1>
          <p className="landing-subtitle">Create a new collaborative document</p>
        </div>

        <form onSubmit={handleSubmit} className="landing-form">
          <div className="form-group">
            <label htmlFor="creatorName" className="form-label">Your name</label>
            <input
              id="creatorName"
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Enter your name"
              className="form-input"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="documentTitle" className="form-label">Document title</label>
            <input
              id="documentTitle"
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="Enter document title"
              className="form-input"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="landing-button"
            disabled={!creatorName.trim() || !documentTitle.trim() || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Document"}
          </button>
        </form>

        <div className="landing-info">
          <p className="info-text">
            ✨ You will become the admin of this document and can invite others to collaborate.
          </p>
        </div>
      </div>
    </div>
  );
};
