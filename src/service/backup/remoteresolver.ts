import {NotImplementedException, UnauthorizedException} from "../../exceptions";
import {ServiceEndpoint} from "../../connection/serviceendpoint";
import {BackupContext} from "./backupcontext";
import {CodeFetcher} from "../../connection/auth/codefetcher";

export class RemoteResolver implements CodeFetcher {
    private readonly targetDid: string;
    private readonly targetHost: string;
    private serviceContext: ServiceEndpoint;
    private backupContext: BackupContext;

    constructor(serviceEndpoint: ServiceEndpoint, backupContext: BackupContext,
                targetServiceDid: string, targetAddress: string) {
        this.serviceContext = serviceEndpoint;
        this.backupContext = backupContext;
        this.targetDid = targetServiceDid;
        this.targetHost = targetAddress;
    }

    async fetch(): Promise<string> {
        try {
            const serviceDid = await this.serviceContext.getServiceInstanceDid();
            return await this.backupContext.getAuthorization(serviceDid, this.targetDid, this.targetHost);
        } catch (e) {
            throw new UnauthorizedException('Failed to create backup credential.', e);
        }
    }

    invalidate(): Promise<void> {
        throw new NotImplementedException();
    }
}
