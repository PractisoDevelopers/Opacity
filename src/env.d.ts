interface Bindings extends Env {
	S3_API_URL?: string;
	S3_ACCESS_KEY_ID?: string;
	S3_ACCESS_KEY?: string;
}

type OpacityEnv = { Bindings: Bindings; Variables: { clientId: string } };
