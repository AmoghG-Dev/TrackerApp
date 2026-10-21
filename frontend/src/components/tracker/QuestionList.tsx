
import { ExternalLink } from "lucide-react";
import type { Question, Status } from "../../types/tracker";

export type TrackerQuestion = Question & {
  apiId: string;
  platform?: string;
};

interface QuestionListProps {
  questions: TrackerQuestion[];
  onStatusChange: (id: number, status: Status) => void;
}

export default function QuestionList({
  questions,
  onStatusChange,
}: QuestionListProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="question-list">
      {questions.map((question) => (
        <article className="question-row" key={question.apiId}>
          <div
            className={`difficulty-badge ${question.difficulty.toLowerCase()}`}
          >
            {question.difficulty}
          </div>

          <div className="question-main">
            <a
              className="question-title"
              href={question.url}
              target="_blank"
              rel="noreferrer"
            >
              {question.title} <ExternalLink size={13} />
            </a>

            <div className="topic-list">
              {question.topics.map((topic) => (
                <span className="topic-tag" key={topic}>
                  {topic}
                </span>
              ))}
            </div>

            {question.platform && (
              <span className="topic-tag">{question.platform}</span>
            )}
          </div>

          <div className="frequency">
            <span>Frequency</span>
            <strong>{question.frequency}/10</strong>
          </div>

          <div className="question-actions">
            <select
              className={`status-select ${question.status.toLowerCase()}`}
              value={question.status}
              onChange={(event) =>
                onStatusChange(
                  question.id,
                  event.target.value as Status,
                )
              }
              aria-label={`Status for ${question.title}`}
            >
              <option value="Pending">Pending</option>
              <option value="Solved">Solved</option>
              <option value="Retry">Retry</option>
            </select>

            <a
              className="solve-button"
              href={question.url}
              target="_blank"
              rel="noreferrer"
            >
              Solve <ExternalLink size={14} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
