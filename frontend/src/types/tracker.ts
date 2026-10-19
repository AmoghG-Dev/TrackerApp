export type Difficulty = "Easy" | "Medium" | "Hard";

export type Status = "Pending" | "Solved" | "Retry";

export type Question = {
  id: number;
  apiId?: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  url: string;
  frequency: number;
  status: Status;
};

export type LearningVideo = {
  id: string;
  title: string;
  duration: number;
  completed: boolean;
};

export type LearningPlaylist = {
  id: string;
  title: string;
  url: string;
  startDate: string;
  videosPerDay: number;
  videos: LearningVideo[];
};
