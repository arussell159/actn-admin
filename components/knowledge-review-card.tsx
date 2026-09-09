import { Button } from "@/components/ui/button"
import {
  knowledgeLocation,
  type KnowledgeAnalysis,
  type KnowledgePendingProposal,
} from "@/lib/ctn-knowledge-review"

export function KnowledgeReviewCard({
  analysis,
  proposal,
  visit,
  status = "pending",
}: {
  analysis: KnowledgeAnalysis
  proposal: KnowledgePendingProposal | null
  visit: (recordId: string, sectionId: string) => void
  status?: "pending" | "applied" | "cancelled" | "superseded"
}) {
  return (
    <div
      className="grid gap-3 rounded-xl bg-muted p-3 text-sm leading-6"
      aria-label="OKF review"
    >
      <strong>Action: {analysis.classification}</strong>
      <p>{analysis.assistantMessage}</p>
      {!proposal &&
        analysis.references.map((reference, index) => (
          <div key={index}>
            <Button
              variant="link"
              className="h-auto max-w-full p-0 text-left whitespace-normal"
              onClick={() => visit(reference.recordId, reference.sectionId)}
            >
              {knowledgeLocation(reference.recordId, reference.sectionId)}
            </Button>
            <p className="font-medium">
              {analysis.classification === "CONFLICT"
                ? "Existing Rule"
                : "Existing Information"}
            </p>
            <p className="whitespace-pre-wrap">{reference.existingText}</p>
          </div>
        ))}
      {analysis.conflict && (
        <div className="grid gap-2">
          <p>
            <strong>New Information:</strong> {analysis.conflict.newInformation}
          </p>
          <p>
            <strong>Issue:</strong> {analysis.conflict.issue}
          </p>
          <p>{analysis.conflict.question}</p>
        </div>
      )}
      {proposal?.files.map((file) => (
        <div key={file.recordId} className="grid gap-2 border-t pt-3">
          <p className="font-medium">{file.nextRecord.country}</p>
          <p className="font-mono text-xs break-all">{file.location}</p>
          {file.currentVersion === file.proposedVersion ? (
            <p>
              <strong>Version:</strong> No change — remains{" "}
              {file.currentVersion}
            </p>
          ) : (
            <p>
              <strong>Current Version:</strong>{" "}
              {file.currentVersion ?? "New file"}
              <br />
              <strong>Proposed Version:</strong> {file.proposedVersion}
            </p>
          )}
          <p>
            <strong>Version Reason:</strong> {file.versionReason}
          </p>
          {file.edits.map((edit, index) => (
            <div key={index} className="grid gap-1 border-l-2 pl-3">
              <p>
                <strong>{edit.action}:</strong>{" "}
                {
                  file.nextRecord.sections.find(
                    (section) => section.id === edit.sectionId
                  )?.title
                }
              </p>
              <p className="font-mono text-xs break-all">
                {knowledgeLocation(file.recordId, edit.sectionId)}
              </p>
              {edit.newSection && (
                <p>
                  <strong>New section:</strong> {edit.newSection.title}
                  <br />
                  {edit.newSection.summary}
                </p>
              )}
              <p>
                <strong>Reason:</strong> {edit.reason}
              </p>
              <p className="font-medium">Current Wording</p>
              <p className="whitespace-pre-wrap">
                {edit.currentContent.join("\n") || "New addition"}
              </p>
              <p className="font-medium">Proposed Wording</p>
              <p className="whitespace-pre-wrap">
                {edit.proposedContent.join("\n") ||
                  "Remove the current wording."}
              </p>
            </div>
          ))}
          {file.changeLogEntry && (
            <p>
              <strong>Change Log:</strong> {file.changeLogEntry}
            </p>
          )}
        </div>
      ))}
      {proposal && <p className="font-medium">{status === "pending" ? "Apply these changes?" : status === "applied" ? "Approved and applied." : status === "cancelled" ? "Cancelled. No changes applied." : "Replaced by a newer review. No changes applied."}</p>}
    </div>
  )
}
