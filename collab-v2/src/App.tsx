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
import { resolveCurrentUser, buildShareLinks, getDocumentMetadata, createDocumentMetadata, saveDocumentMetadata, getOrCreateSessionId, getLocalDocumentSummaries } from "./utils/session";
import { listDocumentRecords, type DocumentSummary } from "./utils/api";

const App: React.FC = () => {
  const [openedFromSharedLink] = React.useState(() => hasSharedDocumentLink());
  const [documentId] = React.useState(() => getCurrentDocumentId());
  const [documentExists, setDocumentExists] = React.useState(() => {
    return openedFromSharedLink || getDocumentMetadata(documentId) !== null;
  });
  const [currentUser, setCurrentUser] = React.useState(() => resolveCurrentUser(documentId));
  const [shareOpen, setShareOpen] = React.useState(false);
  const [documents, setDocuments] = React.useState<DocumentSummary[]>(() => getLocalDocumentSummaries());

  const shareLinks = React.useMemo(() => buildShareLinks(documentId), [documentId]);

  const {
    state,
    currentDraft,
    resolvedTitle,
    wordStats,
    writer,
    effectivePermission,
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
    setDocuments(getLocalDocumentSummaries());
  };

  React.useEffect(() => {
    listDocumentRecords().then((remoteDocuments) => {
      const byId = new Map([...getLocalDocumentSummaries(), ...remoteDocuments].map((doc) => [doc.documentId, doc]));
      setDocuments([...byId.values()]);
    });
  }, []);

  const handleOpenDocument = (nextDocumentId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("doc", nextDocumentId);
    window.location.href = url.toString();
  };

  const handleSetDisplayName = (name: string) => {
    const updatedUser = { ...currentUser, name };
    sessionStorage.setItem("collab-session-v2", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
  };

  if (!documentExists) {
    return (
      <LandingPage
        onCreateDocument={handleCreateDocument}
        documents={documents}
        onOpenDocument={handleOpenDocument}
      />
    );
  }

  const displayUser = {
    ...currentUser,
    permission: isAdmin ? "admin" as const : effectivePermission,
    isAnonymous: isAdmin ? false : currentUser.isAnonymous,
  };

  return (
    <>
      <Topbar
        currentUser={displayUser}
        documentId={documentId}
        resolvedTitle={resolvedTitle}
        viewerCount={viewerCount}
        pendingCount={pendingProposals.length}
        onShare={() => setShareOpen(true)}
      />

      {!canEdit && !isAdmin && <ViewerBanner />}
      {canEdit && !isAdmin && /^Contributor\s+\d+$/.test(currentUser.name) && (
        <div className="modal-backdrop">
          <form
            className="name-modal"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const input = form.elements.namedItem("displayName") as HTMLInputElement;
              if (input.value.trim()) handleSetDisplayName(input.value.trim());
            }}
          >
            <h2 className="modal-title">Choose display name</h2>
            <input className="form-input" name="displayName" placeholder="Your name" autoFocus />
            <button className="landing-button" type="submit">Continue editing</button>
          </form>
        </div>
      )}

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
