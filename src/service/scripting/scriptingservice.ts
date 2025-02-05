import {InvalidParameterException} from '../../exceptions';
import {Condition} from './condition';
import {Executable} from './executable';
import {ServiceEndpoint} from '../../connection/serviceendpoint';
import {Context} from './context';
import {Logger} from '../../utils/logger';
import {checkNotNull, checkArgument} from '../../utils/utils';
import {RestServiceT} from '../restservice';
import {AppContext} from "../..";
import {ScriptingAPI} from "./scriptingapi";

interface HiveUrl {
	targetUsrDid: string,
	targetAppDid: string,
	scriptName: string,
	params: string
}

export class ScriptingService extends RestServiceT<ScriptingAPI> {
	private static LOG = new Logger("ScriptingService");

    constructor(serviceContext: ServiceEndpoint) {
		super(serviceContext);
	}
    
	/**
	* Let the vault owner register a script on his vault for a given application.
	*
	* @param scriptName the name of script to register
	* @param condition the condition on which the script could be executed.
	* @param executable the executable body of the script with preset routines
	* @param allowAnonymousUser whether allows anonymous user.
	* @param allowAnonymousApp whether allows anonymous application.
	* @return Void
	*/
	async registerScript(scriptName: string, executable: Executable, condition?: Condition,
                         allowAnonymousUser?: boolean, allowAnonymousApp?: boolean) : Promise<void> {
		checkNotNull(scriptName, "Missing script name.");
		checkNotNull(executable, "Missing executable script");

        await this.callAPI(ScriptingAPI, async api => {
            return await api.registerScript(await this.getAccessToken(), scriptName, {
                "executable": executable,
                "condition": condition ? condition : undefined,
                "allowAnonymousUser": allowAnonymousUser,
                "allowAnonymousApp": allowAnonymousApp
            });
        });
	}

    /**
     * Let the vault owner unregister a script when the script become useless to
     * applications.
     *
     * @param scriptName the name of the script to unregister.
     */
	async unregisterScript(scriptName: string) : Promise<void>{
        checkNotNull(scriptName, "Missing script name.");

        await this.callAPI(ScriptingAPI, async api => {
            return await api.unregisterScript(await this.getAccessToken(), scriptName);
        });
	}

    /**
     * Executes a previously registered server side script with a normal way.
     * where the values can be passed as part of the query.
     * Vault owner or external users are allowed to call scripts on someone's vault.
     *
     * @param scriptName the name of the script to unregister.
     * @param params parameters to run the script.
     * @param targetDid target DID.
     * @param targetAppDid target application DID.
     */
	async callScript<T>(scriptName: string, params: any, targetDid: string, targetAppDid: string): Promise<T> {
		checkNotNull(scriptName, "Missing script name.");
		checkNotNull(params, "Missing parameters to run the script");
		checkNotNull(targetDid, "Missing target user DID");
		checkNotNull(targetAppDid, "Missing target application DID");

        const context = new Context().setTargetDid(targetDid).setTargetAppDid(targetAppDid);
        return await this.callAPI(ScriptingAPI, async api => {
            return await api.runScript(await this.getAccessToken(), scriptName, { "context": context, "params": params });
        });
	}

    /**
     * Executes a previously registered server side script with a direct URL
     * where the values can be passed as part of the query.
     * Vault owner or external users are allowed to call scripts on someone's vault.
     *
     * @param scriptName the name of the script to unregister.
     * @param params parameters to run the script.
     * @param targetDid target DID.
     * @param targetAppDid target application DID.
     */
	async callScriptUrl<T>(scriptName: string, params: string, targetDid: string, targetAppDid: string): Promise<T> {
		checkNotNull(scriptName, "Missing script name.");
		checkNotNull(params, "Missing parameters to run the script");
		checkNotNull(targetDid, "Missing target user DID");
		checkNotNull(targetAppDid, "Missing target application DID");
		
        return await this.callAPI(ScriptingAPI, async api => {
            return await api.runScriptUrl(await this.getAccessToken(), scriptName, targetDid, targetAppDid, params);
        });
	}

    /**
     * Upload file by transaction ID
     *
     * @param transactionId Transaction ID which can be got by the calling of the script 'fileUpload'.
     * @param data File content.
     * @param callback The callback to get the progress of uploading with percent value. Only supported on browser side.
     */
	async uploadFile(transactionId: string, data: Buffer | string,
                            callback?: (process: number) => void): Promise<void> {
		checkNotNull(transactionId, "Missing transactionId.");
		checkNotNull(data, "data must be provided.");
		const content: Buffer = data instanceof Buffer ? data : Buffer.from(data);
		checkArgument(content.length > 0, "No data to upload.");

        ScriptingService.LOG.debug("Uploading " + content.byteLength + " byte(s)");

        return await this.callAPI(ScriptingAPI, async (api) => {
            return await api.uploadFile(await this.getAccessToken(), transactionId, {
                    'data': content
                });
        }, {
            onUploadProgress: function (progressEvent) {
                if (callback) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    callback(percent);
                }
            }
        });
	}

    /**
     * Download file by transaction ID
     *
     * @param transactionId Transaction ID which can be got by the calling of the script 'fileDownload'.
     * @param callback The callback to get the progress of downloading with percent value. Only supported on browser side.
     */
	async downloadFile(transactionId: string, callback?: (process: number) => void): Promise<Buffer> {
		checkNotNull(transactionId, "Missing transactionId.");

        const dataBuffer = await this.callAPI(ScriptingAPI, async (api) => {
            return api.downloadFile(await this.getAccessToken(), transactionId);
        }, {
            onDownloadProgress: function (progressEvent) {
                if (callback) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    callback(percent);
                }
            }
        });

        ScriptingService.LOG.debug("Downloaded " + Buffer.byteLength(dataBuffer) + " byte(s).");

        return dataBuffer;
	}

	private parseHiveUrl(hiveUrl: string): HiveUrl {
		if (!hiveUrl || !hiveUrl.startsWith('hive://')) {
			throw new InvalidParameterException('Invalid hive url: no hive prefix');
		}
		const parts = hiveUrl.substring('hive://'.length).split('/');
		if (parts.length < 2) {
			throw new InvalidParameterException('Invalid hive url: must contain at least one slash');
		}
		const dids = parts[0].split('@');
		if (dids.length !== 2) {
			throw new InvalidParameterException('Invalid hive url: must contain two DIDs');
		}
		const values = parts[1].split('?params=');
		if (values.length != 2) {
			throw new InvalidParameterException('Invalid hive url: must contain script name and params');
		}
		return {
			targetUsrDid: dids[0],
			targetAppDid: dids[1],
			scriptName: values[0],
			// params: values[1]
            params: '{}' // INFO: compatible with wrong params string, such as {empty:0} [miss "" around empty]
		}
	}

	/**
	 * This is the compatible implementation for downloading file by the hive url
	 * which comes from v1 version SDK. The hive url definition is as this format:
	 * <br>
	 * hive://&lt;targetDid&gt;@&lt;targetAppDid&gt;/&lt;scriptName&gt;?params=&lt;paramJsonStr&gt;
	 *
	 * @param hiveUrl
	 */
	async downloadFileByHiveUrl(hiveUrl: string): Promise<Buffer> {
		const params = this.parseHiveUrl(hiveUrl);

		// Get the provider address for targetDid.
		const targetUrl = await AppContext.getProviderAddressByUserDid(params.targetUsrDid, null, true);
		ScriptingService.LOG.info(`Got the hive url for targetDid: ${targetUrl}`);

		// Prepare the new scripting service for targetDid with current user's appContext.
		const endpoint = new ServiceEndpoint(this.getServiceContext().getAppContext(), targetUrl);
        const scriptingService = new ScriptingService(endpoint);

        // Call on the node contains targetDid vault.
		const result = await scriptingService.callScriptUrl(params.scriptName, params.params, params.targetUsrDid, params.targetAppDid);
		return await scriptingService.downloadFile(Object.values(result)[0]['transaction_id']);
	}
}
