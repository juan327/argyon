export class DTOResponseApi {
    message: string = '';
    // Machine-readable error code (e.g. "vault_reauth_required", "refresh_reuse_detected"),
    // used by the auth interceptor to branch on the failure reason instead of parsing `message`.
    code?: string;
}

export class DTOResponseApiData<T> extends DTOResponseApi {
    data: T = {} as T;
}


export class DTOResponseApiListData<T> extends DTOResponseApi {
    data: T[] = [];
}

export class DTOResponseApiPagedListData<T> extends DTOResponseApiListData<T> {
    totalCount: number = 0;
}