import React from "react";
import type { ActivityEntry } from "../types";

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

const ActivityItem: React.FC<{ entry: ActivityEntry }> = ({ entry }) => (
  <div className="activity-item">
    <span className="act-dot" style={{ background: entry.writer.color }} aria-hidden="true" />
    <div className="act-content">
      <div className="act-text">
        <strong>{entry.writer.name}</strong> {entry.action}
        {entry.preview && `: "${entry.preview}"`}
      </div>
      <div className="act-time">{entry.time}</div>
    </div>
  </div>
);

export const ActivityFeed: React.FC<ActivityFeedProps> = React.memo(({ entries }) => (
  <div className="panel-section">
    <div className="panel-label">Activity log</div>
    <div className="activity-feed" role="log" aria-live="polite">
      {entries.length === 0 ? (
        <span className="empty-hint" style={{ fontSize: 12 }}>No activity yet.</span>
      ) : (
        entries.map((entry) => <ActivityItem key={entry.id} entry={entry} />)
      )}
    </div>
  </div>
));

ActivityFeed.displayName = "ActivityFeed";
