import { HiveException } from "../../exceptions";
import { BackupContext } from "./backupcontext";
import { CodeFetcher } from "../../connection/auth/codefetcher";
import { LocalResolver } from "./localresolver";
import { RemoteResolver } from "./remoteresolver";
import { ServiceEndpoint } from "../../connection/serviceendpoint";
import { DataStorage } from "../../utils/storage/datastorage";

export class CredentialCode {
	private readonly targetServiceDid: string;
	private jwtCode: string;
	private remoteResolver: CodeFetcher;
	private storage: DataStorage;

    constructor(endpoint: ServiceEndpoint, context: BackupContext) {
        this.targetServiceDid = context.getParameter("targetServiceDid");
        let remoteResolver = new RemoteResolver(
        		endpoint, context, this.targetServiceDid, context.getParameter("targetAddress"));
		this.remoteResolver = new LocalResolver(endpoint, remoteResolver);
		this.storage = endpoint.getStorage();
    }
    
    async getToken(): Promise<string> {
		if (this.jwtCode != null)
			return this.jwtCode;

		this.jwtCode = this.restoreToken();
		if (this.jwtCode == null) {
			try {
				this.jwtCode = await this.remoteResolver.fetch();
			} catch (e) {
				throw new HiveException(e.toString());
			}

			if (this.jwtCode != null) {
				this.saveToken(this.jwtCode);
			}
		}
		return this.jwtCode;
	}

	private restoreToken(): string {
		return this.storage.loadBackupCredential(this.targetServiceDid);
	}

	private saveToken(jwtCode: string): void {
		this.storage.storeBackupCredential(this.targetServiceDid, jwtCode);
	}
}
