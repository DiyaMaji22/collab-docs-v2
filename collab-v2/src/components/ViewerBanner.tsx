import React from "react";

export const ViewerBanner: React.FC = () => (
  <div className="viewer-banner" role="status">
    <span className="viewer-banner-icon">👁</span>
    <span>You are viewing this document in <strong>read-only</strong> mode. Your identity is hidden from contributors.</span>
  </div>
);
