// import { EventConfig } from "motia";

// //step - 2
// // converts youtube handle/name to channel ID using youtube data api

// export const config: EventConfig = {
//   name: "ResolveChannel",
//   type: "event",
//   subscribes: ["yt.submit"],
//   emits: ["yt.channel.resolved", "yt.channel.error"],
// };

// //handler

// export const handler = async (eventData: any, { emit, logger, state }: any) => {
//   //logic
//   //you should have a job id and email
//   let jobId: string | undefined;
//   let email: string | undefined;

//   try {
//     //filter your data @ or without @
//     const data = eventData || {};
//     jobId = data.jobId;
//     email = data.emaill;
//     const channel = data.channel;

//     logger.info("Resolving youtube channel", { jobId, channel });

//     //grab the youtube key
//     const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
//     if (!YOUTUBE_API_KEY) {
//       throw new Error("Youtube api key not configured");
//     }

//     //update the job status
//     const jobData = await state.get(`job: ${jobId}`);
//     await state.set(`job: ${jobId}`, {
//       ...jobData,
//       status: "resolving channel",
//     });

//     let channelId: string | null = null;
//     let channelName: string = "";

//     if (channel.startsWith("@")) {
//       const handle = channel.substring(1);

//       const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
//         handle
//       )}&key=${YOUTUBE_API_KEY}`;

//       const searchResponse = await fetch(searchUrl);
//       const searchData = await searchResponse.json();

//       if (searchData.items && searchData.items.lenth > 0) {
//         channelId = searchData.items[0].snippet.channelId;
//         channelName = searchData.items[0].snippet.title;
//       }
//     } else {
//       const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
//         channel
//       )}&key=${YOUTUBE_API_KEY}`;
//       const searchResponse = await fetch(searchUrl);
//       const searchData = await searchResponse.json();

//       if (searchData.items && searchData.items.lenth > 0) {
//         channelId = searchData.items[0].snippet.channelId;
//         channelName = searchData.items[0].snippet.title;
//       }
//     }

//     if (!channelId) {
//       logger.error("channel not found", { channel });

//       await state.set(`Job: ${jobId}`, {
//         ...jobData,
//         status: "failed",
//         error: "channel not found",
//       });
//     }

//     await emit({
//       topic: "yt.channel.resolved",
//       data: {
//         jobId,
//         email,
//       },
//     });
//     return;
//   } catch (error: any) {
//     logger.error("Error resolving channel", { error: error.message });
//     if (!jobId || !email) {
//       logger.error("Cannot send error notification - missing jobId or email");
//       return;
//     }

//     const jobData = await state.get(`job: ${jobId}`);
//     await state.set(`job:${jobId}`, {
//       ...jobData,
//       status: "failed",
//       error: "error.message",
//     });

//     await emit({
//       topIC: "yt.channel.error",
//       data: {
//         jobId,
//         email,
//         error: "Failed to resolve channel. please try again",
//       },
//     });
//   }
// };
import { EventConfig } from "motia";

// ----------------------------------------
// STEP 2
// Resolve YouTube handle/name → Channel ID
// ----------------------------------------

export const config: EventConfig = {
  name: "ResolveChannel",
  type: "event",
  subscribes: ["yt.submit"], // listens to event emitted from Step 1
  emits: ["yt.channel.resolved", "yt.channel.error"], // success OR failure events
};

// ----------------------------------------------------
// Handler Logic
// Receives: jobId, email, channel (from yt.submit event)
// Goal: Convert handle/name → channelId using YouTube API
// ----------------------------------------------------

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;

  try {
    // safely extract event data
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email; // FIXED typo: was emaill
    const channel = data.channel;

    logger.info("Resolving YouTube channel…", { jobId, channel });

    // ----------------------------------------
    // 1. Validate YouTube API key
    // ----------------------------------------
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      throw new Error("YouTube API key not configured");
    }

    // ----------------------------------------
    // 2. Update the job status → "resolving channel"
    // ----------------------------------------
    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "resolving channel",
    });

    // ----------------------------------------
    // 3. Resolve channelId & name
    // ----------------------------------------
    let channelId: string | null = null;
    let channelName: string = "";

    // Build search query (handle @username OR normal name)
    const query = channel.startsWith("@") ? channel.substring(1) : channel;

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
      query
    )}&key=${YOUTUBE_API_KEY}`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    // FIXED typo: lenth → length
    if (searchData.items && searchData.items.length > 0) {
      channelId = searchData.items[0].snippet.channelId;
      channelName = searchData.items[0].snippet.title;
    }

    // ----------------------------------------
    // 4. If no channel found → update state & emit error
    // ----------------------------------------
    if (!channelId) {
      logger.error("Channel not found", { channel });

      await state.set(`job:${jobId}`, {
        ...jobData,
        status: "failed",
        error: "Channel not found",
      });

      await emit({
        topic: "yt.channel.error",
        data: {
          jobId,
          email,
          error: "Channel not found. Please try again.",
        },
      });

      return;
    }

    // ----------------------------------------
    // 5. Success → emit resolved event
    // ----------------------------------------
    await emit({
      topic: "yt.channel.resolved",
      data: {
        jobId,
        email,
        channelId,
        channelName,
      },
    });

    return;
  } catch (error: any) {
    logger.error("Error resolving channel", { error: error.message });

    if (!jobId || !email) {
      logger.error("Cannot send error notification — jobId/email missing");
      return;
    }

    // Update job as failed
    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "failed",
      error: error.message,
    });

    // Emit error event
    await emit({
      topic: "yt.channel.error", // FIXED typo: topIC
      data: {
        jobId,
        email,
        error: "Failed to resolve channel. Please try again.",
      },
    });
  }
};
