import {
  rpc,
  TransactionBuilder,
  Networks,
  Account,
  Contract,
  xdr
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { EXPECTED_NETWORK_PASSPHRASE } from "./wallet";
import { SorobanContractError } from "@/src/lib/errors/contractErrors";

export class SorobanService {
  private rpcServer: rpc.Server;

  constructor(rpcUrl: string = "https://rpc-futurenet.stellar.org") {
    this.rpcServer = new rpc.Server(rpcUrl);
  }

  /**
   * Load the real account sequence from the network
   */
  async getAccount(publicKey: string): Promise<Account> {
    const accountResponse = await this.rpcServer.getAccount(publicKey);
    return new Account(publicKey, accountResponse.sequenceNumber());
  }

  /**
   * Simulate the contract call to generate the footprint
   */
  async simulateAndPrepare(
    tx: any,
    networkPassphrase = EXPECTED_NETWORK_PASSPHRASE
  ): Promise<any> {
    const simulation = await this.rpcServer.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(simulation)) {
      const failedSimulation = simulation as {
        error?: unknown;
        errorResultXdr?: unknown;
        diagnosticEvents?: unknown;
        resultXdr?: unknown;
      };
      const message =
        typeof failedSimulation.error === "string"
          ? failedSimulation.error
          : "Soroban transaction simulation failed";
      throw new SorobanContractError(`Simulation failed: ${message}`, {
        resultXdr:
          typeof failedSimulation.errorResultXdr === "string"
            ? failedSimulation.errorResultXdr
            : typeof failedSimulation.resultXdr === "string"
              ? failedSimulation.resultXdr
              : undefined,
        diagnosticPayload:
          failedSimulation.diagnosticEvents ??
          failedSimulation.errorResultXdr ??
          failedSimulation.error,
      });
    }
    return rpc.assembleTransaction(tx, simulation).build();
  }

  async prepareContractCall({
    publicKey,
    contractId,
    method,
    args = [],
    networkPassphrase = EXPECTED_NETWORK_PASSPHRASE,
  }: {
    publicKey: string;
    contractId: string;
    method: string;
    args?: xdr.ScVal[];
    networkPassphrase?: string;
  }) {
    const account = await this.getAccount(publicKey);
    const transaction = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();

    return this.simulateAndPrepare(transaction, networkPassphrase);
  }

  /**
   * Build, simulate, sign through Freighter, submit and poll.
   */
  async executeContractCall({
    publicKey,
    contractId,
    method,
    args = [],
    timeoutMs = 30000,
    networkPassphrase = EXPECTED_NETWORK_PASSPHRASE,
  }: {
    publicKey: string;
    contractId: string;
    method: string;
    args?: xdr.ScVal[];
    timeoutMs?: number;
    networkPassphrase?: string;
  }): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
    // 1. Build, simulate, and prepare the contract call
    const preparedTx = await this.prepareContractCall({
      publicKey,
      contractId,
      method,
      args,
      networkPassphrase,
    });

    // 4. Sign through Freighter
    const signedTxXdr = await signTransaction(preparedTx.toXDR(), { networkPassphrase });
    
    // Some versions of freighter return a string, some return an object
    const finalXdrStr = typeof signedTxXdr === 'string' ? signedTxXdr : (signedTxXdr as any).signedTxXdr;
    if (!finalXdrStr) {
      throw new Error("Failed to sign transaction through Freighter");
    }

    const signedTx = TransactionBuilder.fromXDR(finalXdrStr, networkPassphrase);

    // 5. Submit
    const sendResponse = await this.rpcServer.sendTransaction(signedTx);
    if (sendResponse.status === "ERROR") {
      const failedSubmission = sendResponse as {
        errorResultXdr?: unknown;
        errorResult?: unknown;
      };
      const resultXdr =
        typeof failedSubmission.errorResultXdr === "string"
          ? failedSubmission.errorResultXdr
          : undefined;
      throw new SorobanContractError(
        `Transaction submission failed: ${
          resultXdr ??
          (typeof failedSubmission.errorResult === "string"
            ? failedSubmission.errorResult
            : "unknown Soroban submission error")
        }`,
        {
          resultXdr,
          diagnosticPayload:
            failedSubmission.errorResultXdr ?? failedSubmission.errorResult,
        },
      );
    }

    // 6. Poll with timeout handling
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const statusResponse = await this.rpcServer.getTransaction(sendResponse.hash);
      
      if (statusResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return statusResponse as rpc.Api.GetSuccessfulTransactionResponse;
      }
      
      if (statusResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new SorobanContractError(
          `Transaction failed on-chain: ${statusResponse.resultXdr}`,
          {
            resultXdr: statusResponse.resultXdr,
            diagnosticPayload: statusResponse.resultXdr,
          },
        );
      }
      
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`Transaction polling timed out after ${timeoutMs}ms`);
  }
}
