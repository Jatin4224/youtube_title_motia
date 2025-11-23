import { ApiRouteConfig } from "motia";

//step - 1:
//Accept channel name and email to start the workflow
export const config: ApiRouteConfig = {
  name: "SubmitChannel",
  type: "api",
  path: "/submit",
  method: "POST", // PUT , DELETE , GET
  emits: ["yt.submit"], // once we get the data what kind of event it is going to emit so other steps can listen to it
};

interface SubmitRequest {
  channel: string;
  email: string;
}

// feel free to study more about logger object // in motia we use logger instead of console
export const handler = async (req: any, { emit, logger, state }: any) => {
  try {
    logger.info("Received submission request", { body: req.body });
    const { channel, email } = req.body as SubmitRequest;

    if (!channel || !email) {
      return {
        status: 400,
        body: { error: "Missing required fields: channel and email" },
      };
    }

    // validate
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        body: { error: "Invalid email format" },
      };
    }

    const jobId = `job_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    await state.set(`job:${jobId}`, {
      jobId,
      channel,
      email,
      status: "queued",
      createdAt: new Date().toISOString(),
    });

    logger.info("Job Created", { jobId, channel, email });

    await emit("yt.submit", {
      jobId,
      channel,
      email,
    });

    return {
      status: 200,
      body: {
        success: true,
        jobId,
        message:
          "Your request has been queued. You get an email soon with imporved suggestions for your youtube videos",
      },
    };
  } catch (error: any) {
    logger.error("Error in submission handler", { error: error.message });
    return {
      status: 500,
      body: {
        error: "Internal server error",
      },
    };
  }
};
