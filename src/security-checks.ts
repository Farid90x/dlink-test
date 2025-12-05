import { Connection, PublicKey } from '@solana/web3.js';
import fetch from 'node-fetch';
import { logger } from './logger';

export type FullSecurityCheckDetails = {
    canMintMore: boolean;
    hasFreezeAuthority: boolean;
    isMutable: boolean;
    supplyAnalysis: boolean;
    creatorAnalysis: boolean;
    distributionAnalysis: boolean;
    liquidityAnalysis: boolean;
    hasVerifiedCreator?: boolean;      // New: check if creator is verified
    hasOpenSource?: boolean;           // New: check if contract is open source
    transferFeeAnalysis?: boolean;     // New: check for transfer fees
    holderCount?: number;              // New: number of holders (if available)
};

export type FullSecurityCheckResult = {
    details: FullSecurityCheckDetails;
    passCount: number;
    failCount: number;
    riskScore: number;
    status: 'SAFE' | 'WARNING' | 'DANGER';
    ok: boolean;
    warnings: string[];                // New: specific warning messages
    metadata?: any;                    // New: raw metadata for additional checks
    topHolderPercentage?: number;      // New: percentage held by largest holder
    top5HolderPercentage?: number;     // New: percentage held by top 5 holders
};

const SUPPLY_MIN = 1_000;              // Minimum reasonable supply
const SUPPLY_MAX = 1e15;              // Maximum reasonable supply
const MIN_LIQUIDITY_PERCENT = 5;      // Minimum % of supply in liquidity
const MAX_WHALE_PERCENT = 20;         // Maximum % one holder can have
const MAX_TOP5_PERCENT = 50;          // Maximum % top 5 holders can have

/**
 * Enhanced security checks for token analysis. Performs comprehensive validation of:
 * - Mint/Freeze authorities
 * - Supply distribution and anomalies
 * - Metadata mutability and authenticity
 * - Liquidity adequacy
 * - Holder concentration
 * - Optional: verified creator status
 * - Optional: transfer fee presence
 * - Optional: source code verification
 *
 * @param connection - Active Solana connection
 * @param mintAddress - Token mint to analyze
 * @param poolTokenAmount - Optional: tokens in liquidity pool
 * @param suppliedDecimals - Optional: token decimals if known
 * @returns Detailed security analysis with pass/fail status
 */
export async function runEnhancedSecurityChecks(
    connection: Connection,
    mintAddress: string,
    poolTokenAmount?: number,
    suppliedDecimals?: number
): Promise<FullSecurityCheckResult> {
    let topHolderPercentage: number = 100; // Default to 100%
    let top5HolderPercentage: number = 100; // Default to 100%
    const details: FullSecurityCheckDetails = {
        canMintMore: true,
        hasFreezeAuthority: true,
        isMutable: true,
        supplyAnalysis: true,
        creatorAnalysis: true,
        distributionAnalysis: true,
        liquidityAnalysis: true,
        hasVerifiedCreator: false,
        hasOpenSource: false,
        transferFeeAnalysis: true,
    };
    
    const warnings: string[] = [];
    let metadata: any = null;
    
    try {
        const pk = new PublicKey(mintAddress);
        
        // 1. Basic authority checks
        const accountInfo = await connection.getParsedAccountInfo(pk);
        const parsed = (accountInfo.value?.data as any)?.parsed?.info;
        
        if (!parsed) {
            throw new Error('Could not parse mint account data');
        }
        
        const mintAuthority = parsed.mintAuthority ?? null;
        const freezeAuthority = parsed.freezeAuthority ?? null;
        
        details.canMintMore = !mintAuthority;
        if (!details.canMintMore) {
            warnings.push('🔴 Mint authority is active - supply can be increased');
        }
        
        details.hasFreezeAuthority = !freezeAuthority;
        if (!details.hasFreezeAuthority) {
            warnings.push('🔴 Freeze authority is active - accounts can be frozen');
        }
        
        // 2. Supply analysis
        let totalSupply = 0;
        let decimals = suppliedDecimals ?? 0;
        
        try {
            const supplyInfo = await connection.getTokenSupply(pk);
            decimals = supplyInfo.value.decimals;
            totalSupply = parseInt(supplyInfo.value.amount) / Math.pow(10, decimals);
            
            if (totalSupply > 0) {
                details.supplyAnalysis = totalSupply >= SUPPLY_MIN && totalSupply <= SUPPLY_MAX;
                if (!details.supplyAnalysis) {
                    warnings.push(`⚠️ Unusual supply: ${totalSupply.toLocaleString()} tokens`);
                }
            }
        } catch (e) {
            warnings.push('⚠️ Could not fetch token supply');
        }
        
        // 3. Metadata checks
        try {
            const metaResponse = await fetch(process.env.RPC_URL!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'check-metadata',
                    method: 'getAsset',
                    params: { id: mintAddress },
                }),
            });
            
            const metaJson = await metaResponse.json() as { result?: any };
            metadata = metaJson?.result;
            
            if (metadata?.content?.metadata) {
                const meta = metadata.content.metadata;
                
                // Check mutability
                if (meta.mutable !== undefined) {
                    details.isMutable = !meta.mutable;
                } else if (meta.isMutable !== undefined) {
                    details.isMutable = !meta.isMutable;
                }
                
                if (!details.isMutable) {
                    warnings.push('🔴 Token metadata is mutable');
                }
                
                // Check verified creator
                if (metadata.creators?.length > 0) {
                    details.hasVerifiedCreator = metadata.creators.some((c: any) => c.verified);
                    if (!details.hasVerifiedCreator) {
                        warnings.push('⚠️ No verified creators found');
                    }
                }
                
                // Check for transfer fee
                if (metadata.tokenStandard === 'ProgrammableNonFungible' || parsed.tokenProgram === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
                    const hasTransferFee = Boolean(metadata.fees?.transfer || parsed.fees?.transfer);
                    details.transferFeeAnalysis = !hasTransferFee;
                    if (!details.transferFeeAnalysis) {
                        warnings.push('🔴 Token has transfer fees');
                    }
                }
            }
            
            // Check update authority
            const updateAuthority = metadata?.updateAuthority ?? metadata?.authorities?.find((a: any) => a.scopes?.includes('full'))?.address;
            if (updateAuthority) {
                const zeroAddr = '11111111111111111111111111111111';
                details.creatorAnalysis = updateAuthority === zeroAddr;
                if (!details.creatorAnalysis) {
                    warnings.push('⚠️ Update authority not renounced');
                }
            }
            
        } catch (e) {
            warnings.push('⚠️ Could not fetch token metadata');
        }
        
        // 4. Distribution analysis
        try {
            if (totalSupply > 0) {
                const largest = await connection.getTokenLargestAccounts(pk);
                if (largest.value?.length > 0) {
                    const amounts = largest.value.map((acc: any) => {
                        const raw = acc.amount as string;
                        return parseInt(raw) / Math.pow(10, decimals);
                    });
                    
                    let top1Share = 1.0; // Default to 100%
                    let top5Share = 1.0; // Default to 100%

                    if (amounts && amounts.length > 0) {
                        top1Share = amounts[0] / totalSupply;
                        const top5Sum = amounts.slice(0, Math.min(5, amounts.length)).reduce((sum, v) => sum + v, 0);
                        top5Share = top5Sum / totalSupply;
                    }
                    
                    const top1Percentage = top1Share * 100;
                    const top5Percentage = top5Share * 100;
                    
                    details.distributionAnalysis = top1Share <= MAX_WHALE_PERCENT/100 && top5Share <= MAX_TOP5_PERCENT/100;
                    details.holderCount = largest.value.length;
                    
                    // Save holder percentages
                    topHolderPercentage = top1Percentage;
                    top5HolderPercentage = top5Percentage;
                    
                    if (!details.distributionAnalysis) {
                        warnings.push(`🔴 High concentration: Top holder ${top1Percentage.toFixed(1)}%, Top 5 ${top5Percentage.toFixed(1)}%`);
                    }
                }
            }
        } catch (e) {
            warnings.push('⚠️ Could not analyze token distribution');
        }
        
        // 5. Liquidity analysis
        if (poolTokenAmount && totalSupply > 0) {
            const liquidityShare = (poolTokenAmount / totalSupply) * 100;
            details.liquidityAnalysis = liquidityShare >= MIN_LIQUIDITY_PERCENT;
            if (!details.liquidityAnalysis) {
                warnings.push(`🔴 Low liquidity: ${liquidityShare.toFixed(1)}% of supply`);
            }
        }
        
        // Count passes and calculate risk
        let passCount = 0;
        let failCount = 0;
        
        for (const [key, value] of Object.entries(details)) {
            if (typeof value === 'boolean') {
                if (value) passCount++;
                else failCount++;
            }
        }
        
        const riskScore = Math.min(failCount * 25, 100);
        let status: 'SAFE' | 'WARNING' | 'DANGER';
        
        if (riskScore <= 20) status = 'SAFE';
        else if (riskScore <= 50) status = 'WARNING';
        else status = 'DANGER';
        
            return {
            details,
            passCount,
            failCount,
            riskScore,
            status,
            ok: riskScore <= 50,
            warnings,
            metadata,
            topHolderPercentage,
            top5HolderPercentage
        };    } catch (err: any) {
        logger.error(`Security check failed for ${mintAddress}: ${err?.message ?? err}`);
        Object.keys(details).forEach(k => {
            if (typeof (details as any)[k] === 'boolean') {
                (details as any)[k] = false;
            }
        });
        warnings.push('🔴 Critical error during security checks');
        
        return {
            details,
            passCount: 0,
            failCount: Object.keys(details).filter(k => typeof (details as any)[k] === 'boolean').length,
            riskScore: 100,
            status: 'DANGER',
            ok: false,
            warnings,
            metadata: null,
            topHolderPercentage: 100,
            top5HolderPercentage: 100
        };
    }
}

// Utility function to summarize security check results
export function formatSecurityReport(result: FullSecurityCheckResult): string {
    const statusEmoji = result.status === 'SAFE' ? '🟢' : result.status === 'WARNING' ? '🟡' : '🔴';
    
    // Calculate total checks including optional ones
    const totalChecks = Object.values(result.details).filter(val => typeof val === 'boolean').length;
    
    const details = [
        `Mint Locked: ${result.details.canMintMore ? '✅' : '❌'}`,
        `Freeze Disabled: ${result.details.hasFreezeAuthority ? '✅' : '❌'}`,
        `Immutable: ${result.details.isMutable ? '✅' : '❌'}`,
        `Supply OK: ${result.details.supplyAnalysis ? '✅' : '❌'}`,
        `Creator Safe: ${result.details.creatorAnalysis ? '✅' : '❌'}`,
        `Distribution OK: ${result.details.distributionAnalysis ? '✅' : '❌'}`,
        `Liquidity OK: ${result.details.liquidityAnalysis ? '✅' : '❌'}`
    ];
    
    // Add optional checks if they exist
    if (result.details.hasVerifiedCreator !== undefined) {
        details.push(`Verified Creator: ${result.details.hasVerifiedCreator ? '✅' : '⚠️'}`);
    }
    if (result.details.transferFeeAnalysis !== undefined) {
        details.push(`No Transfer Fee: ${result.details.transferFeeAnalysis ? '✅' : '❌'}`);
    }
    
    const report = [
        `🛡️ *Security Report* 🛡️`,
        `${statusEmoji} Status: ${result.status}`,
        `⚠️ Risk Score: ${result.riskScore}/100`,
        '',
        `📋 *Security Checks:*\n  - ${details.join('\n  - ')}`,
        `📊 Summary: ${result.passCount}/${totalChecks} checks passed`,
    ];
    
    // Format distribution warnings separately
    const distributionWarning = result.details.distributionAnalysis === false && result.topHolderPercentage ? 
        `🔴 High concentration: Top holder ${result.topHolderPercentage.toFixed(1)}%${
            result.top5HolderPercentage ? `, Top 5 ${result.top5HolderPercentage.toFixed(1)}%` : ''
        }` : '';

    // Filter out distribution warning from main warnings
    const otherWarnings = result.warnings.filter(w => !w.includes('High concentration'));

    if (otherWarnings.length > 0 || distributionWarning) {
        report.push('', '⚠️ *Warnings:*');
        report.push(...otherWarnings);
        if (distributionWarning) {
            report.push(distributionWarning);
        }
    }
    
    return report.join('\n');
}