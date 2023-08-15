import type { RequestHandler } from "./$types";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";
import { error, redirect } from "@sveltejs/kit";
import { base } from "$app/paths";
import { z } from "zod";
import type { Message } from "$lib/types/Message";
import { fetchModels, fallbackModel } from "$lib/server/models";
import { authCondition } from "$lib/server/auth";

export const POST: RequestHandler = async ({ locals, request }) => {
	const body = await request.text();

	let title = "";
	let messages: Message[] = [];

	const values = z
		.object({
			fromShare: z.string().optional(),
			model: z.string(),
		})
		.parse(JSON.parse(body));

	let models = await fetchModels();
	let model_id = values.model == fallbackModel.id && models.length > 0 ? models[0].id : values.model;
	if (values.fromShare) {
		const conversation = await collections.sharedConversations.findOne({
			_id: values.fromShare,
		});

		if (!conversation) {
			throw error(404, "Conversation not found");
		}

		title = conversation.title;
		messages = conversation.messages;
		values.model = model_id;
	}

	const res = await collections.conversations.insertOne({
		_id: new ObjectId(),
		title:
			title ||
			"Untitled " + ((await collections.conversations.countDocuments(authCondition(locals))) + 1),
		messages,
		model: model_id,
		createdAt: new Date(),
		updatedAt: new Date(),
		...(locals.user ? { userId: locals.user._id } : { sessionId: locals.sessionId }),
		...(values.fromShare ? { meta: { fromShareId: values.fromShare } } : {}),
	});

	return new Response(
		JSON.stringify({
			conversationId: res.insertedId.toString(),
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
};

export const GET: RequestHandler = async () => {
	throw redirect(302, `${base}/`);
};
