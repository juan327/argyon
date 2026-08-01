export class VMSetup {
    authHash: string = '';
}

export class VMEnable {
    authHash: string = '';
    code: string = '';
}

export class VMDisable {
    authHash: string = '';
    code: string = '';
}

export class VMRegenerateRecoveryCodes {
    authHash: string = '';
    code: string = '';
}

export class VMVerifyLogin {
    pendingToken: string = '';
    code: string = '';
}
