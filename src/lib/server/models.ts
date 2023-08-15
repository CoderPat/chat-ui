import { TGI_CENTRAL_ADDRESS } from "$env/static/private";
import { defaults } from "autoprefixer";
import { z } from "zod";

const validateModelSchema = z.array(
	z.object({
		/** Used as an identifier in DB */
		id: z.string().optional(),
		/** Used to link to the model page, and for inference */
		name: z.string().min(1),
		displayName: z.string().min(1).optional(),
    owner: z.string().min(1).optional(),
    is_quantized: z.boolean().optional().default(false),
		description: z.string().min(1).optional(),
		websiteUrl: z.string().url().optional(),
		modelUrl: z.string().url().optional(),
		datasetName: z.string().min(1).optional(),
		datasetUrl: z.string().url().optional(),
		userMessageToken: z.string(),
		userMessageEndToken: z.string().default(""),
		assistantMessageToken: z.string(),
		assistantMessageEndToken: z.string().default(""),
		messageEndToken: z.string().default(""),
		preprompt: z.string().default(""),
		prepromptUrl: z.string().url().optional(),
		promptExamples: z
			.array(
				z.object({
					title: z.string().min(1),
					prompt: z.string().min(1),
				})
			)
			.optional(),
		endpoints: z
			.array(
				z.object({
					url: z.string().url(),
					weight: z.number().int().positive().default(1),
				})
			)
			.optional(),
		parameters: z
			.object({
				temperature: z.number().min(0).max(1),
				truncate: z.number().int().positive(),
				max_new_tokens: z.number().int().positive(),
				stop: z.array(z.string()).optional(),
			})
			.passthrough()
			.optional(),
		})
);

//get type from zod schema
export type BackendModel = z.infer<typeof validateModelSchema>;

// TODO: this should be model specific
const DEFAULTS = {
  userMessageToken: "<|prompter|>",
  assistantMessageToken: "<|assistant|>",
  messageEndToken: "</s>",
  preprompt: "Below are a series of dialogues between various people and an AI assistant. The AI tries to be helpful, polite, honest, sophisticated, emotionally aware, and humble-but-knowledgeable. The assistant is happy to help with almost anything, and will do its best to understand exactly what is needed. It also tries to avoid giving false or misleading information, and it caveats when it isn't entirely sure about the right answer. That said, the assistant is practical and really does its best, and doesn't let caution get too much in the way of being useful.\n-----\n",
  promptExamples: [
    {
      title: "Write an email from bullet list",
      prompt: "As a restaurant owner, write a professional email to the supplier to get these products every week: \n\n- Wine (x10)\n- Eggs (x24)\n- Bread (x12)"
    }, {
      title: "Code a snake game",
      prompt: "Code a basic snake game in python, give explanations for each step."
    }, {
      title: "Assist in a task",
      prompt: "How do I make a delicious lemon cheesecake?"
    }
  ],
  parameters: {
      temperature: 0.9,
      top_p: 0.95,
      repetition_penalty: 1.2,
      top_k: 50,
      truncate: 1000,
      max_new_tokens: 1024,
      do_sample: true,
    }
};

// make a function that overwrite defaults for some known models
// TODO: this shouldn't be here, but for now this works
const getDefaults = (model_id: string) => {
  let defaults = structuredClone(DEFAULTS)
  // for now, defaults are hardcoded, but we should allow someway
  // to overwrite them in the future, probably through the Central?
  return defaults
}


export const fetchModels = async (): Promise<BackendModel[]> => {
  const response = await fetch("http://"+TGI_CENTRAL_ADDRESS+"/list_models");
  const modelsList = await response.json();


  	// replace url (just ip:port) with endpoint based on /generate_stream
	// replacing the key `url with `endpoint`
   const modelsListProcessed = modelsList.map((m) => ({
      id: m.name,
      name: m.name,
      owner: m.owner,
      displayName: m.name,
      is_quantized: m.is_quantized,
	    ...getDefaults(m.name),
      endpoints: [ { url: 'http://' + m.address, weight: 1 } ],
  }));

  const models = validateModelSchema.parse(modelsListProcessed);
  // Return the models.
  return models;
}

const defaultModels = validateModelSchema.parse([{
  id: "default",
  name: "default",
  displayName: "Default",
  description: "Example Description.",
  ...getDefaults("default"),
  endpoints: [ { url: "http://0.0.0.0:8888", weight: 1 } ],
}]);

export const fallbackModel = defaultModels[0];

// Models that have been deprecated
export const oldModels = [];

export const validateModel = (_models: BackendModel[]) => {
	// Zod enum function requires 2 parameters
	return z.enum([_models[0].id, ..._models.slice(1).map((m) => m.id)]);
};
