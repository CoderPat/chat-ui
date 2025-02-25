import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { collections } from "$lib/server/database";
import type { Conversation } from "$lib/types/Conversation";
import { UrlDependency } from "$lib/types/UrlDependency";
import { fallbackModel, fetchModels, oldModels, validateModel } from "$lib/server/models";
import { authCondition, requiresUser } from "$lib/server/auth";
import { DEFAULT_SETTINGS } from "$lib/types/Settings";
import { SERPAPI_KEY, SERPER_API_KEY, MESSAGES_BEFORE_LOGIN } from "$env/static/private";

export const load: LayoutServerLoad = async ({ locals, depends, url }) => {
	const { conversations } = collections;
	const urlModel = url.searchParams.get("model");

	depends(UrlDependency.ConversationList);

	let models = await fetchModels();
	if (urlModel) {
		const isValidModel = validateModel(models).safeParse(urlModel).success;

		if (isValidModel) {
			await collections.settings.updateOne(
				authCondition(locals),
				{ $set: { activeModel: urlModel } },
				{ upsert: true }
			);
		}

		throw redirect(302, url.pathname);
	}

	const settings = await collections.settings.findOne(authCondition(locals));


	// if we were able to get models, and the settings is not set / set to the
	// fallback model, set it to the first model in the list
	if (models.length > 0 && (!settings || settings.activeModel === fallbackModel.id)) {
		await collections.settings.updateOne(authCondition(locals), {
			$set: { activeModel: models[0].id },
		});
	}

	// if active model is fallback and list has elements, set it to first element
	// if (settings && settings.activeModel === fallbackModel.id && models.length > 0) {
	// 	settings.activeModel = models[0].id;
	// 	await collections.settings.updateOne(authCondition(locals), {
	// 		$set: { activeModel: models[0].id },
	// 	});
	// }
	// If the active model in settings is not valid, set it to the default model. This can happen if model was disabled.
	// if (settings && !validateModel(models).safeParse(settings?.activeModel).success) {
	// 	settings.activeModel = defaultModel.id;
	// 	await collections.settings.updateOne(authCondition(locals), {
	// 		$set: { activeModel: defaultModel.id },
	// 	});
	// }

	return {
		conversations: await conversations
			.find(authCondition(locals))
			.sort({ updatedAt: -1 })
			.project<Pick<Conversation, "title" | "model" | "_id" | "updatedAt" | "createdAt">>({
				title: 1,
				model: 1,
				_id: 1,
				updatedAt: 1,
				createdAt: 1,
			})
			.map((conv) => ({
				id: conv._id.toString(),
				title: conv.title,
				model: conv.model ?? fallbackModel,
			}))
			.toArray(),
		settings: {
			shareConversationsWithModelAuthors:
				settings?.shareConversationsWithModelAuthors ??
				DEFAULT_SETTINGS.shareConversationsWithModelAuthors,
			ethicsModalAcceptedAt: settings?.ethicsModalAcceptedAt ?? null,
			activeModel: settings?.activeModel ?? fallbackModel.id,
			searchEnabled: !!(SERPAPI_KEY || SERPER_API_KEY),
		},
		models: models.map((model) => ({
			id: model.id,
			name: model.name,
			websiteUrl: model.websiteUrl,
			modelUrl: model.modelUrl,
			datasetName: model.datasetName,
			datasetUrl: model.datasetUrl,
			displayName: model.displayName,
			owner: model.owner,
			is_quantized: model.is_quantized,
			description: model.description,
			promptExamples: model.promptExamples,
			parameters: model.parameters,
		})),
		oldModels,
		user: locals.user && {
			username: locals.user.username,
			avatarUrl: locals.user.avatarUrl,
			email: locals.user.email,
		},
		requiresLogin: requiresUser,
		messagesBeforeLogin: MESSAGES_BEFORE_LOGIN ? parseInt(MESSAGES_BEFORE_LOGIN) : 0,
	};
};
