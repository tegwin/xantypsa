// ============================================================
// Which XantyPSA is this?
// ============================================================
// The same codebase ships two ways, and the difference has to be explicit
// rather than inferred:
//
//   self_hosted — someone runs it themselves. No billing, no plan limits, no
//                 upgrade prompts. Nagging a self-hoster to upgrade would be
//                 obnoxious and is the fastest way to lose the open source
//                 goodwill the project depends on.
//
//   hosted      — the paid service. Tenants carry a subscription, plan limits
//                 apply, and signup goes through billing.
//
// Defaults to self_hosted, so a fork or a fresh clone never accidentally
// presents itself as a paid product.

export type DeploymentMode = 'self_hosted' | 'hosted';

export function deploymentMode(): DeploymentMode {
  return process.env.DEPLOYMENT_MODE === 'hosted' ? 'hosted' : 'self_hosted';
}

/** True only on the commercial service. Gate all billing UI on this. */
export function isHosted(): boolean {
  return deploymentMode() === 'hosted';
}

export function isSelfHosted(): boolean {
  return !isHosted();
}
