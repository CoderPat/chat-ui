import { fallbackModel } from "$lib/server/models";
import { modelEndpoint } from "./modelEndpoint";
import { textGeneration } from "@huggingface/inference";
import { trimSuffix } from "$lib/utils/trimSuffix";
import { trimPrefix } from "$lib/utils/trimPrefix";
import { PUBLIC_SEP_TOKEN } from "$lib/constants/publicSepToken";

interface Parameters {
	temperature: number;
	truncate: number;
	max_new_tokens: number;
	stop: string[];
}
export async function generateFromDefaultEndpoint(
	prompt: string,
	parameters?: Partial<Parameters>
) {
	const newParameters = {
		...fallbackModel.parameters,
		...parameters,
		return_full_text: false,
	};

	const endpoint = modelEndpoint(fallbackModel);
	let { generated_text } = await textGeneration(
		{
			model: endpoint.url,
			inputs: prompt,
			parameters: newParameters,
		},
		{
			fetch: (url, options) =>
				fetch(url, {
					...options,
					headers: { ...options?.headers, Authorization: endpoint.authorization },
				}),
		}
	);

	generated_text = trimSuffix(
		trimPrefix(generated_text, "<|startoftext|>"),
		PUBLIC_SEP_TOKEN
	).trimEnd();

	for (const stop of [...(newParameters?.stop ?? []), "<|endoftext|>"]) {
		if (generated_text.endsWith(stop)) {
			generated_text = generated_text.slice(0, -stop.length).trimEnd();
		}
	}

	return generated_text;
}
