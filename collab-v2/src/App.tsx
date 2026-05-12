import React from "react";
import { Topbar } from "./components/Topbar";
import { EditorPanel } from "./components/EditorPanel";
import { DocumentCanvas } from "./components/DocumentCanvas";
import { CollaboratorsPanel } from "./components/CollaboratorsPanel";
import { ActivityFeed } from "./components/ActivityFeed";
import { PendingChanges } from "./components/PendingChanges";
import { ViewerBanner } from "./components/ViewerBanner";
import { ShareModal } from "./components/ShareModal";
import { LandingPage } from "./components/LandingPage";
import { useCollaborativeDocument } from "./hooks/useCollaborativeDocument";
import { getCurrentDocumentId, hasSharedDocumentLink } from "./utils/documentSession";
import { resolveCurrentUser, buildShareLinks, getDocumentMetadata, createDocumentMetadata, saveDocumentMetadata, getOrCreateSessionId } from "./utils/session";

const App: React.FC = () => {
  const [openedFromSharedLink] = React.useState(() => hasSharedDocumentLink());
  const [documentId] = React.useState(() => getCurrentDocumentId());
  const [documentExists, setDocumentExists] = React.useState(() => {
    return openedFromSharedLink || getDocumentMetadata(documentId) !== null;
  });
  const [currentUser, setCurrentUser] = React.useState(() => resolveCurrentUser(documentId));
  const [shareOpen, setShareOpen] = React.useState(false);

  const shareLinks = React.useMemo(() => buildShareLinks(documentId), [documentId]);

  const {
    state,
    currentDraft,
    resolvedTitle,
    wordStats,
    writer,
    isAdmin,
    canEdit,
    pendingProposals,
    viewerCount,
    metadata,
    initializeDocument,
    updateDraft,
    saveDraft,
    acceptProposal,
    rejectProposal,
    setFocusActivity,
    clearFocusActivity,
  } = useCollaborativeDocument(documentId, currentUser);

  const handleCreateDocument = (creatorName: string, documentTitle: string) => {
    // Create metadata with the current user as creator/admin
    const sessionId = getOrCreateSessionId();
    const metadata = createDocumentMetadata(documentId, sessionId, creatorName);
    saveDocumentMetadata(metadata);
    initializeDocument(documentTitle);

    // Update session with the creator name
    const updatedUser = {
      ...currentUser,
      name: creatorName,
      permission: "admin" as const,
    };
    sessionStorage.setItem("collab-session-v2", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setDocumentExists(true);
  };

  if (!documentExists) {
    return <LandingPage onCreateDocument={handleCreateDocument} />;
  }

  return (
    <>
      <Topbar
        currentUser={currentUser}
        resolvedTitle={resolvedTitle}
        viewerCount={viewerCount}
        pendingCount={pendingProposals.length}
        onShare={() => setShareOpen(true)}
      />

      {!canEdit && !isAdmin && <ViewerBanner />}

      <div className={`workspace${!canEdit && !isAdmin ? " viewer-mode" : ""}`}>
        {/* Left: editor or view-only placeholder */}
        {(canEdit || isAdmin) ? (
          <div className="editors-col">
            <EditorPanel
              writer={writer}
              draft={currentDraft}
              presence={state.presence[currentUser.sessionId] ?? { isTyping: false, activity: "Idle" }}
              isAdmin={isAdmin}
              saveLabel={isAdmin ? "Save document" : "Submit for review"}
              onUpdate={updateDraft}
              onSave={saveDraft}
              onFocus={setFocusActivity}
              onBlur={clearFocusActivity}
            />
          </div>
        ) : (
          <div className="editors-col viewer-left">
            <div className="viewer-left-content">
              <div className="viewer-left-icon">👁</div>
              <div className="viewer-left-title">View only</div>
              <div className="viewer-left-desc">You have read-only access to this document. Request edit access from the admin.</div>
            </div>
          </div>
        )}

        {/* Center: document canvas */}
        <DocumentCanvas
          document={state.document}
          resolvedTitle={resolvedTitle}
        />

        {/* Right: sidebar */}
        <div className="activity-col">
          <CollaboratorsPanel
            isAdmin={isAdmin}
            presence={state.presence}
            viewers={state.viewers}
            viewerCount={viewerCount}
            wordStats={wordStats}
          />

          {isAdmin && (
            <PendingChanges
              proposals={pendingProposals}
              onAccept={acceptProposal}
              onReject={rejectProposal}
            />
          )}

          <ActivityFeed entries={state.activityLog} />
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          shareLinks={shareLinks}
          onClose={() => setShareOpen(false)}
          isAdmin={isAdmin}
          metadata={metadata}
        />
      )}
    </>
  );
};

export default App;
