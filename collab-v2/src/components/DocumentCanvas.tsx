import React from "react";
import type { WriterDraft } from "../types";
import { formatBodyText } from "../utils/text";

interface DocumentCanvasProps {
  document: WriterDraft;
  resolvedTitle: string;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = React.memo(({
  document,
  resolvedTitle,
}) => {
  const hasBody = document.body.trim().length > 0;

  return (
    <div className="doc-col">
      <div className="paper">
        <h1>
          {resolvedTitle ? (
            <span>{resolvedTitle}</span>
          ) : (
            <span className="empty-hint">Document title will appear here...</span>
          )}
        </h1>

        <div className="doc-body">
          {hasBody ? (
            <div
              className="document-text"
              dangerouslySetInnerHTML={{ __html: formatBodyText(document.body) }}
            />
          ) : (
            <span className="empty-hint">
              Accepted document content will appear here.
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

DocumentCanvas.displayName = "DocumentCanvas";
