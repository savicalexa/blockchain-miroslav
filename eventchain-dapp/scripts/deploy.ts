import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { network } from "hardhat";

const { ethers, networkName } = await network.create();

console.log(`Deploying EventManager to ${networkName}...`);

const eventManager = await ethers.deployContract("EventManager");
await eventManager.waitForDeployment();

const address = await eventManager.getAddress();
const chain = await ethers.provider.getNetwork();
const deploymentPath = resolve("public/deployment.json");
const deployment = {
  contractAddress: address,
  chainId: Number(chain.chainId),
  networkName,
  deployedAt: new Date().toISOString(),
};

await mkdir(dirname(deploymentPath), { recursive: true });
await writeFile(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

console.log("EventManager address:", address);
console.log("Chain ID:", chain.chainId.toString());
console.log("Frontend configuration updated: public/deployment.json");
console.log("Deployment successful!");
