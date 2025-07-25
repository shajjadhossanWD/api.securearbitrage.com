import * as dataService from './dataService.js';
// import * as predictionService from './predictionService.js';

// Track prediction periods globally
let predictionPeriodCount = 0;
const predictionPeriodStart = new Date();


// Track successful predictions
export async function recordPredictionResult(pairAddress, wasSuccessful) {
    try {
        const tokenDoc = await dataService.getTokenData(pairAddress);
        if (!tokenDoc) return;

          // Prevent duplicate recording
        const lastPredictionTime = new Date(tokenDoc.predictionAccuracy.lastPredictionTime || 0);
        if (Date.now() - lastPredictionTime < 60000) { // 1 minute cooldown
            return;
        }

        // Update current period stats
        tokenDoc.predictionAccuracy.currentTotal += 1;
        if (wasSuccessful) {
            tokenDoc.predictionAccuracy.currentHits += 1;
        }
        tokenDoc.predictionAccuracy.lastPredictionTime = new Date();

        await tokenDoc.save();
    } catch (error) {
        console.error(`Error recording prediction result for ${pairAddress}:`, error);
    }
}

// Rotate accuracy periods (move current to past)
// export async function rotateAccuracyPeriods() {
//     try {
//         const allTokens = await dataService.getAllPairAddresses();
        
//         for (const pairAddress of allTokens) {
//             const tokenDoc = await dataService.getTokenData(pairAddress);
//             if (!tokenDoc) continue;

//             // Move current to past
//             tokenDoc.predictionAccuracy.pastHits = tokenDoc.predictionAccuracy.currentHits;
//             tokenDoc.predictionAccuracy.pastTotal = tokenDoc.predictionAccuracy.currentTotal;
            
//             // Reset current
//             tokenDoc.predictionAccuracy.currentHits = 0;
//             tokenDoc.predictionAccuracy.currentTotal = 0;
//             tokenDoc.predictionAccuracy.lastResetTime = new Date();
            
//             await tokenDoc.save();
//         }
//     } catch (error) {
//         console.error('Error rotating accuracy periods:', error);
//     }
// }
export async function rotateAccuracyPeriods() {
    try {
        const allPairAddresses = await dataService.getAllPairAddresses();
        
        for (const pairAddress of allPairAddresses) {
            const tokenData = await dataService.getTokenData(pairAddress);
            if (!tokenData) continue;

            if (!tokenData.predictionAccuracy) {
                tokenData.predictionAccuracy = {
                    pastHits: 0,
                    currentHits: 0
                };
            }

            // Move current to past
            tokenData.predictionAccuracy.pastHits = tokenData.predictionAccuracy.currentHits || 0;
            tokenData.predictionAccuracy.currentHits = 0;
            
            await tokenData.save();
        }

        predictionPeriodCount++;
        console.log(`🔄 Rotated accuracy periods. Total periods: ${predictionPeriodCount}`);
    } catch (error) {
        console.error('Error rotating accuracy periods:', error);
    }
}

// Get accuracy stats for all tokens
// export async function getGlobalAccuracyStats() {
//     try {
//         // const allTokens = await TokenData.find({});
//         const allPairAddresses = await dataService.getAllPairAddresses();
        
//         let globalStats = {
//             pastHits: 0,
//             pastTotal: 0,
//             currentHits: 0,
//             currentTotal: 0
//         };

//          // Fetch each token's data individually
//         for (const pairAddress of allPairAddresses) {
//             const tokenData = await dataService.getTokenData(pairAddress);
//             if (!tokenData || !tokenData.predictionAccuracy) continue;

//             globalStats.pastHits += tokenData.predictionAccuracy.pastHits || 0;
//             globalStats.pastTotal += tokenData.predictionAccuracy.pastTotal || 0;
//             globalStats.currentHits += tokenData.predictionAccuracy.currentHits || 0;
//             globalStats.currentTotal += tokenData.predictionAccuracy.currentTotal || 0;
//         }

//         return {
//             pastAccuracy: globalStats.pastTotal > 0 
//                 ? `${globalStats.pastHits}/${globalStats.pastTotal} (${((globalStats.pastHits/globalStats.pastTotal)*100).toFixed(2)}%)`
//                 : 'N/A',
//             currentAccuracy: globalStats.currentTotal > 0 
//                 ? `${globalStats.currentHits}/${globalStats.currentTotal} (${((globalStats.currentHits/globalStats.currentTotal)*100).toFixed(2)}%)`
//                 : 'N/A',
//             lastResetTime: new Date().toISOString()
//         };
//     } catch (error) {
//         console.error('Error getting global accuracy stats:', error);
//         return {
//             pastAccuracy: 'N/A',
//             currentAccuracy: 'N/A',
//             lastResetTime: 'N/A'
//         };
//     }
// }

export async function getGlobalAccuracyStats() {
    try {
        const allPairAddresses = await dataService.getAllPairAddresses();
        const numTokens = allPairAddresses.length;
        
        let totalPastHits = 0;
        let totalCurrentHits = 0;

        // Get hits only (totals are based on token count × periods)
        for (const pairAddress of allPairAddresses) {
            const tokenData = await dataService.getTokenData(pairAddress);
            if (!tokenData?.predictionAccuracy) continue;

            totalPastHits += tokenData.predictionAccuracy.pastHits || 0;
            totalCurrentHits += tokenData.predictionAccuracy.currentHits || 0;
        }

        // Calculate proper denominators
        const pastPredictionsTotal = numTokens * predictionPeriodCount;
        const currentPredictionsTotal = numTokens; // Current period only

        return {
            pastAccuracy: pastPredictionsTotal > 0 
                ? `${totalPastHits}/${pastPredictionsTotal} (${((totalPastHits/pastPredictionsTotal)*100).toFixed(2)}%)`
                : 'N/A (No past periods)',
            currentAccuracy: numTokens > 0
                ? `${totalCurrentHits}/${numTokens} (${((totalCurrentHits/numTokens)*100).toFixed(2)}%)`
                : 'N/A (No tokens)',
            lastResetTime: predictionPeriodStart.toISOString(),
            predictionPeriods: predictionPeriodCount,
            activeTokens: numTokens
        };
    } catch (error) {
        console.error('Error getting accuracy stats:', error);
        return {
            pastAccuracy: 'Error',
            currentAccuracy: 'Error',
            lastResetTime: 'N/A',
            predictionPeriods: 0,
            activeTokens: 0
        };
    }
}
