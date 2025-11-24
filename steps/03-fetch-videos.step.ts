import { EventConfig } from "motia";

// ----------------------------------------
// STEP 3
// retrievs the latest 5 videos from the channel id
// ----------------------------------------

export const config: EventConfig = {
  name: "fetchVideos",
  type: "event",
  subscribes: ["yt.channel.resolved"],
  emits: ["yt.videos.fetched", "yt.videos.error"],
};

interface Video {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;

  try {
    // getting all the data
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;
    const channelId = data.channelId;
    const channelName = data.channelName;

    // added explanation: logging the channel we are fetching videos for
    logger.info("Fetching latest YouTube videos…", { jobId, channelId });

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      throw new Error("YouTube API key not configured");
    }

    // update job state → this helps UI track progress
    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "fetching videos",
    });

    // added explanation: search endpoint that fetches latest 5 videos
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=5&key=${YOUTUBE_API_KEY}`;

    // calling YouTube API
    const response = await fetch(searchUrl);
    const youtubeData = await response.json();

    // when channel has no recent videos
    if (!youtubeData.items || youtubeData.items.length === 0) {
      logger.warn("No Videos found for channel", {
        jobId,
        channelId,
      });

      // ❗ FIXED BUG — key should be job:${jobId}, not job: ${jobId}
      await state.set(`job:${jobId}`, {
        ...jobData,
        status: "failed",
        error: "No Videos found",
      });

      await emit({
        topic: "yt.videos.error",
        data: {
          jobId,
          email,
          error: "No Videos found for this channel",
        },
      });
      return;
    }

    // converting API results into cleaner structure
    const videos: Video[] = youtubeData.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails.default.url,
    }));

    logger.info("Videos fetched successfully", {
      jobId,
      videoCount: videos.length,
    });

    // ❗ FIXED BUG — same issue with job: ${jobId}
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "videos fetched",
      videos,
    });

    // sending success event to next workflow step
    await emit({
      topic: "yt.videos.fetched",
      data: {
        jobId,
        channelName,
        videos,
        email,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching videos", { error: error.message });

    // if job/email missing → cannot send event
    if (!jobId || !email) {
      logger.error("Cannot send error notification — jobId/email missing");
      return;
    }

    const jobData = await state.get(`job:${jobId}`);

    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "failed",
      error: error.message,
    });

    await emit({
      topic: "yt.videos.error",
      data: {
        jobId,
        email,
        error: "Failed to fetch videos.please try again later",
      },
    });
  }
};
