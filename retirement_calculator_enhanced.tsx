import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const RetirementCalculator = () => {
  const [startingYear, setStartingYear] = useState(2025);
  const [maxAge, setMaxAge] = useState(95);
  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(65);
  const [taxRate, setTaxRate] = useState(22);
  const [filingStatus, setFilingStatus] = useState('marriedJoint');
  const [runMonteCarloSims, setRunMonteCarloSims] = useState(false);
  const [numSimulations, setNumSimulations] = useState(1000);
  const [volatility, setVolatility] = useState(15);
  const [showDetailedTable, setShowDetailedTable] = useState(false);
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false);
  const [monteCarloComplete, setMonteCarloComplete] = useState(false);

  // Investment Accounts with age restrictions and withdrawal rules
  const [investmentAccounts, setInvestmentAccounts] = useState([
    { id: 1, name: "Taxable Brokerage", balance: 100000, type: "taxable", withdrawalOrder: 1, minAge: 0 },
    { id: 2, name: "Military TSP", balance: 200000, type: "traditional", withdrawalOrder: 2, minAge: 59.5 },
    { id: 3, name: "Roth TSP", balance: 100000, type: "roth", withdrawalOrder: 3, minAge: 59.5 },
    { id: 4, name: "401k/403b", balance: 150000, type: "traditional", withdrawalOrder: 4, minAge: 59.5 },
    { id: 5, name: "Roth IRA", balance: 75000, type: "roth", withdrawalOrder: 5, minAge: 59.5 },
    { id: 6, name: "HSA", balance: 25000, type: "hsa", withdrawalOrder: 6, minAge: 65 }
  ]);

  // Fixed Income Streams
  const [incomeStreams, setIncomeStreams] = useState([
    { id: 1, name: "Military Pension", monthlyAmount: 3500, startAge: 45, endAge: 95, taxable: true, cola: 2.5, isAnnual: false },
    { id: 2, name: "Federal Pension", monthlyAmount: 2200, startAge: 62, endAge: 95, taxable: true, cola: 1.5, isAnnual: false },
    { id: 3, name: "VA Disability", monthlyAmount: 3100, startAge: 35, endAge: 95, taxable: false, cola: 2.0, isAnnual: false },
    { id: 4, name: "SS Supplement", monthlyAmount: 1400, startAge: 57, endAge: 61, taxable: true, cola: 0, isAnnual: false },
    { id: 5, name: "Social Security (Primary)", monthlyAmount: 2800, startAge: 67, endAge: 95, taxable: true, cola: 2.5, isAnnual: false },
    { id: 6, name: "Social Security (Spouse)", monthlyAmount: 1900, startAge: 67, endAge: 95, taxable: true, cola: 2.5, isAnnual: false }
  ]);

  const [preRetirementReturn, setPreRetirementReturn] = useState(7);
  const [postRetirementReturn, setPostRetirementReturn] = useState(5);
  const [withdrawalType, setWithdrawalType] = useState('percentage');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [withdrawalRates, setWithdrawalRates] = useState([
    { ageStart: 65, ageEnd: 70, rate: 3.5, dollarAmount: 50000 },
    { ageStart: 71, ageEnd: 80, rate: 4.0, dollarAmount: 60000 },
    { ageStart: 81, ageEnd: 95, rate: 5.0, dollarAmount: 70000 }
  ]);
  
  const [results, setResults] = useState([]);
  const [monteCarloResults, setMonteCarloResults] = useState([]);

  // Update withdrawal rates when retirement age changes
  useEffect(() => {
    setWithdrawalRates(currentRates => {
      if (currentRates.length === 0) return currentRates;
      
      const updatedRates = [...currentRates];
      if (updatedRates[0]) {
        updatedRates[0] = { ...updatedRates[0], ageStart: retirementAge };
      }
      
      for (let i = 1; i < updatedRates.length; i++) {
        if (updatedRates[i].ageStart < updatedRates[i-1].ageEnd + 1) {
          updatedRates[i] = { ...updatedRates[i], ageStart: updatedRates[i-1].ageEnd + 1 };
        }
      }
      
      return updatedRates;
    });
  }, [retirementAge]);

  // Preset strategies
  const presetStrategies = {
    conservative: { 
      name: "Conservative", 
      rates: [{ ageStart: retirementAge, ageEnd: maxAge, rate: 3.5, dollarAmount: 45000 }] 
    },
    moderate: { 
      name: "Moderate", 
      rates: [
        { ageStart: retirementAge, ageEnd: retirementAge + 5, rate: 3.5, dollarAmount: 50000 }, 
        { ageStart: retirementAge + 6, ageEnd: maxAge, rate: 4.0, dollarAmount: 60000 }
      ] 
    },
    aggressive: { 
      name: "Aggressive", 
      rates: [{ ageStart: retirementAge, ageEnd: maxAge, rate: 5.0, dollarAmount: 75000 }] 
    },
    ageDecreasing: { 
      name: "Age-Decreasing", 
      rates: [
        { ageStart: retirementAge, ageEnd: retirementAge + 5, rate: 4.5, dollarAmount: 70000 }, 
        { ageStart: retirementAge + 6, ageEnd: retirementAge + 15, rate: 3.5, dollarAmount: 55000 }, 
        { ageStart: retirementAge + 16, ageEnd: maxAge, rate: 2.5, dollarAmount: 40000 }
      ] 
    },
    dieWithNothing: { name: "Die with Nothing", rates: [] }
  };

  // Capital gains tax rates based on filing status and income
  const getCapitalGainsTaxRate = (totalTaxableIncome) => {
    const brackets = {
      single: { bracket0: 48350, bracket15: 533400 },
      marriedJoint: { bracket0: 96700, bracket15: 600050 },
      marriedSeparate: { bracket0: 48350, bracket15: 300000 },
      headOfHousehold: { bracket0: 64750, bracket15: 566700 }
    };

    const currentBrackets = brackets[filingStatus] || brackets.marriedJoint;

    if (totalTaxableIncome <= currentBrackets.bracket0) return 0;
    if (totalTaxableIncome <= currentBrackets.bracket15) return 0.15;
    return 0.20;
  };

  // Tax rates by account type
  const getAccountTaxRate = (accountType, totalTaxableIncome) => {
    switch (accountType) {
      case 'roth':
      case 'hsa':
        return 0;
      case 'traditional':
        return taxRate / 100;
      case 'taxable':
        return getCapitalGainsTaxRate(totalTaxableIncome);
      default:
        return 0;
    }
  };

  // Tax-efficient withdrawal with age restrictions
  const performWithdrawal = (accounts, targetAmount, totalFixedTaxableIncome, currentAge) => {
    // Only withdraw from accounts where age >= minAge
    const availableAccounts = accounts.filter(acc => currentAge >= acc.minAge);
    const sortedAccounts = availableAccounts.sort((a, b) => a.withdrawalOrder - b.withdrawalOrder);
    
    let remainingAmount = targetAmount;
    let totalTaxes = 0;
    const withdrawals = [];

    for (const account of sortedAccounts) {
      if (remainingAmount <= 0 || account.balance <= 0) continue;
      const withdrawalAmount = Math.min(remainingAmount, account.balance);
      
      const totalTaxableIncome = totalFixedTaxableIncome + withdrawalAmount;
      const taxes = withdrawalAmount * getAccountTaxRate(account.type, totalTaxableIncome);
      
      withdrawals.push({ accountId: account.id, accountName: account.name, amount: withdrawalAmount, taxes });
      account.balance -= withdrawalAmount;
      totalTaxes += taxes;
      remainingAmount -= withdrawalAmount;
    }

    return { withdrawals, totalTaxes, actualWithdrawn: targetAmount - remainingAmount };
  };

  const calculateDieWithNothingStrategy = () => {
    const totalInvestments = investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const yearsInRetirement = maxAge - retirementAge;
    const annualWithdrawal = totalInvestments / yearsInRetirement;
    return [{ ageStart: retirementAge, ageEnd: maxAge, rate: 0, dollarAmount: annualWithdrawal }];
  };

  const getCurrentWithdrawalAmount = (age, totalBalance) => {
    for (let tier of withdrawalRates) {
      if (age >= tier.ageStart && age <= tier.ageEnd) {
        return withdrawalType === 'percentage' ? totalBalance * (tier.rate / 100) : tier.dollarAmount;
      }
    }
    return totalBalance * 0.04;
  };

  // Monte Carlo simulation with enhanced results
  const runMonteCarloSimulation = async () => {
    setIsRunningMonteCarlo(true);
    setMonteCarloComplete(false);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const simResults = [];
    const survivalData = { age70: 0, age80: 0, age90: 0, age95: 0, age100: 0 };
    
    for (let sim = 0; sim < numSimulations; sim++) {
      let accountBalances = investmentAccounts.map(acc => ({ ...acc }));
      let finalAge = currentAge;
      
      for (let age = currentAge; age <= Math.min(maxAge, 100); age++) {
        finalAge = age;
        const isRetired = age >= retirementAge;
        const baseReturn = isRetired ? postRetirementReturn : preRetirementReturn;
        const randomReturn = baseReturn + (Math.random() - 0.5) * 2 * volatility;
        const growthRate = randomReturn / 100;
        
        accountBalances.forEach(account => account.balance *= (1 + growthRate));
        const totalBalance = accountBalances.reduce((sum, acc) => sum + acc.balance, 0);
        
        if (totalBalance > 0) {
          if (age >= 70) survivalData.age70++;
          if (age >= 80) survivalData.age80++;
          if (age >= 90) survivalData.age90++;
          if (age >= 95) survivalData.age95++;
          if (age >= 100) survivalData.age100++;
        }
        
        if (isRetired && totalBalance > 0) {
          const targetWithdrawal = getCurrentWithdrawalAmount(age, totalBalance);
          
          let totalTaxableFixedIncome = 0;
          incomeStreams.forEach(stream => {
            if (age >= stream.startAge && age <= stream.endAge && stream.taxable) {
              const yearsFromStart = age - stream.startAge;
              const baseAmount = stream.isAnnual ? stream.monthlyAmount : stream.monthlyAmount * 12;
              const adjustedAmount = baseAmount * Math.pow(1 + (stream.cola / 100), yearsFromStart);
              totalTaxableFixedIncome += adjustedAmount;
            }
          });
          
          const withdrawalResult = performWithdrawal(accountBalances, targetWithdrawal, totalTaxableFixedIncome);
          withdrawalResult.withdrawals.forEach(w => {
            const account = accountBalances.find(acc => acc.id === w.accountId);
            if (account) account.balance -= w.amount;
          });
        }
        
        if (accountBalances.reduce((sum, acc) => sum + acc.balance, 0) <= 0) break;
      }
      
      simResults.push({
        finalBalance: Math.max(0, accountBalances.reduce((sum, acc) => sum + acc.balance, 0)),
        finalAge: finalAge
      });
    }
    
    const balances = simResults.map(r => r.finalBalance).sort((a, b) => a - b);
    const p10 = balances[Math.floor(balances.length * 0.1)] || 0;
    const p25 = balances[Math.floor(balances.length * 0.25)] || 0;
    const p50 = balances[Math.floor(balances.length * 0.5)] || 0;
    const p75 = balances[Math.floor(balances.length * 0.75)] || 0;
    const p90 = balances[Math.floor(balances.length * 0.9)] || 0;
    
    const survivalProbabilities = {
      age70: ((survivalData.age70 / numSimulations) * 100).toFixed(1),
      age80: ((survivalData.age80 / numSimulations) * 100).toFixed(1),
      age90: ((survivalData.age90 / numSimulations) * 100).toFixed(1),
      age95: ((survivalData.age95 / numSimulations) * 100).toFixed(1),
      age100: ((survivalData.age100 / numSimulations) * 100).toFixed(1)
    };
    
    setMonteCarloResults([{
      p10, p25, p50, p75, p90,
      survivalProbabilities,
      totalSimulations: numSimulations
    }]);
    
    setIsRunningMonteCarlo(false);
    setMonteCarloComplete(true);
  };

  const calculateProjection = () => {
    const data = [];
    let accountBalances = investmentAccounts.map(acc => ({ ...acc }));
    
    for (let age = currentAge; age <= maxAge; age++) {
      const year = startingYear + (age - currentAge);
      const isRetired = age >= retirementAge;
      const growthRate = isRetired ? postRetirementReturn / 100 : preRetirementReturn / 100;
      
      accountBalances.forEach(account => {
        account.balance *= (1 + growthRate);
      });
      
      const totalBalance = accountBalances.reduce((sum, acc) => sum + acc.balance, 0);
      
      let withdrawalResult = { withdrawals: [], totalTaxes: 0, actualWithdrawn: 0 };
      
      if (isRetired && totalBalance > 0) {
        const targetWithdrawal = getCurrentWithdrawalAmount(age, totalBalance);
        
        let totalTaxableFixedIncome = 0;
        incomeStreams.forEach(stream => {
          if (age >= stream.startAge && age <= stream.endAge && stream.taxable) {
            const yearsFromStart = age - stream.startAge;
            const baseAmount = stream.isAnnual ? stream.monthlyAmount : stream.monthlyAmount * 12;
            const adjustedAmount = baseAmount * Math.pow(1 + (stream.cola / 100), yearsFromStart);
            totalTaxableFixedIncome += adjustedAmount;
          }
        });
        
        withdrawalResult = performWithdrawal([...accountBalances], targetWithdrawal, totalTaxableFixedIncome, age);
        withdrawalResult.withdrawals.forEach(w => {
          const account = accountBalances.find(acc => acc.id === w.accountId);
          if (account) account.balance -= w.amount;
        });
      }

      let totalGrossFixedIncome = 0;
      let totalTaxableFixedIncome = 0;

      incomeStreams.forEach(stream => {
        if (age >= stream.startAge && age <= stream.endAge) {
          const yearsFromStart = age - stream.startAge;
          const baseAmount = stream.isAnnual ? stream.monthlyAmount : stream.monthlyAmount * 12;
          const adjustedAmount = baseAmount * Math.pow(1 + (stream.cola / 100), yearsFromStart);
          
          totalGrossFixedIncome += adjustedAmount;
          if (stream.taxable) totalTaxableFixedIncome += adjustedAmount;
        }
      });

      const fixedIncomeTaxes = totalTaxableFixedIncome * (taxRate / 100);
      const totalTaxes = withdrawalResult.totalTaxes + fixedIncomeTaxes;
      const totalNetIncome = withdrawalResult.actualWithdrawn + totalGrossFixedIncome - totalTaxes;
      
      data.push({
        age, year,
        balance: Math.max(0, Math.round(accountBalances.reduce((sum, acc) => sum + acc.balance, 0))),
        withdrawal: Math.round(withdrawalResult.actualWithdrawn),
        grossFixedIncome: Math.round(totalGrossFixedIncome),
        totalTaxes: Math.round(totalTaxes),
        totalGrossIncome: Math.round(withdrawalResult.actualWithdrawn + totalGrossFixedIncome),
        totalNetIncome: Math.round(totalNetIncome),
        accountBalances: accountBalances.map(acc => ({
          id: acc.id,
          name: acc.name,
          balance: Math.round(acc.balance)
        })),
        incomeStreamsDetail: incomeStreams.map(stream => {
          if (age >= stream.startAge && age <= stream.endAge) {
            const yearsFromStart = age - stream.startAge;
            const baseAmount = stream.isAnnual ? stream.monthlyAmount : stream.monthlyAmount * 12;
            const adjustedAmount = baseAmount * Math.pow(1 + (stream.cola / 100), yearsFromStart);
            return {
              id: stream.id,
              name: stream.name,
              amount: Math.round(adjustedAmount),
              taxable: stream.taxable
            };
          }
          return null;
        }).filter(stream => stream !== null)
      });
      
      if (accountBalances.reduce((sum, acc) => sum + acc.balance, 0) <= 0) break;
    }
    
    setResults(data);
  };

  useEffect(() => {
    calculateProjection();
  }, [
    startingYear, maxAge, currentAge, retirementAge, investmentAccounts, incomeStreams,
    preRetirementReturn, postRetirementReturn, withdrawalRates, taxRate, withdrawalType
  ]);

  // Custom tooltip components
  const CustomIncomeTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalIncome = data.withdrawal + data.grossFixedIncome;
      
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold">{`Age: ${label}`}</p>
          <div className="mt-2">
            <p className="text-blue-600 font-medium">
              Investment Withdrawals: {formatCurrency(data.withdrawal)}
            </p>
            <p className="text-green-600 font-medium">
              Fixed Income Total: {formatCurrency(data.grossFixedIncome)}
            </p>
            {data.incomeStreamsDetail && data.incomeStreamsDetail.length > 0 && (
              <div className="mt-2 pl-4 border-l-2 border-green-200">
                {data.incomeStreamsDetail.map(stream => (
                  <p key={stream.id} className="text-sm text-gray-600">
                    • {stream.name}: {formatCurrency(stream.amount)} {!stream.taxable && "(Tax-Free)"}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="font-bold text-gray-800">
                Total Income: {formatCurrency(totalIncome)}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomBalanceTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalBalance = data.balance;
      
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold">{`Age: ${label}`}</p>
          <div className="mt-2">
            <p className="text-blue-600 font-medium mb-2">
              Total Balance: {formatCurrency(totalBalance)}
            </p>
            {data.accountBalances && data.accountBalances.length > 0 && (
              <div className="space-y-1">
                {data.accountBalances
                  .filter(acc => acc.balance > 0)
                  .sort((a, b) => b.balance - a.balance)
                  .map(account => (
                    <p key={account.id} className="text-sm text-gray-600">
                      • {account.name}: {formatCurrency(account.balance)}
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const totalInvestmentAccounts = investmentAccounts.reduce((sum, account) => sum + account.balance, 0);

  // Export to PDF function
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    
    const pdfContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Retirement Planning Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 30px; page-break-inside: avoid; }
            .section h2 { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
            .card { border: 1px solid #d1d5db; padding: 15px; border-radius: 8px; background-color: #f9fafb; }
            .highlight { background-color: #dbeafe; padding: 10px; border-radius: 5px; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .summary-stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat-box { text-align: center; padding: 15px; border: 2px solid #2563eb; border-radius: 8px; }
            .small-text { font-size: 12px; color: #6b7280; }
            @media print { body { margin: 0; } .page-break { page-break-before: always; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Retirement Planning Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="section small-text">
            <p><strong>Disclaimer:</strong> This report is for planning purposes only.</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(pdfContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    };
  };

  // Functions
  const addInvestmentAccount = () => {
    const newId = Math.max(...investmentAccounts.map(a => a.id)) + 1;
    setInvestmentAccounts([...investmentAccounts, { 
      id: newId, 
      name: "New Account", 
      balance: 0, 
      type: "taxable", 
      withdrawalOrder: investmentAccounts.length + 1,
      minAge: 0
    }]);
  };

  const removeInvestmentAccount = (id) => {
    setInvestmentAccounts(investmentAccounts.filter(account => account.id !== id));
  };

  const updateInvestmentAccount = (id, field, value) => {
    setInvestmentAccounts(investmentAccounts.map(account => account.id === id ? { ...account, [field]: value } : account));
  };

  const addIncomeStream = () => {
    const newId = Math.max(...incomeStreams.map(s => s.id)) + 1;
    setIncomeStreams([...incomeStreams, { id: newId, name: "New Income", monthlyAmount: 1000, startAge: 65, endAge: 95, taxable: true, cola: 2.0, isAnnual: false }]);
  };

  const removeIncomeStream = (id) => {
    setIncomeStreams(incomeStreams.filter(stream => stream.id !== id));
  };

  const updateIncomeStream = (id, field, value) => {
    setIncomeStreams(incomeStreams.map(stream => stream.id === id ? { ...stream, [field]: value } : stream));
  };

  const addWithdrawalTier = () => {
    const lastTier = withdrawalRates[withdrawalRates.length - 1];
    setWithdrawalRates([...withdrawalRates, {
      ageStart: lastTier.ageEnd + 1,
      ageEnd: maxAge,
      rate: 4.0,
      dollarAmount: 60000
    }]);
  };

  const removeWithdrawalTier = (index) => {
    if (withdrawalRates.length > 1) {
      setWithdrawalRates(withdrawalRates.filter((_, i) => i !== index));
    }
  };

  const updateWithdrawalRate = (index, field, value) => {
    const newRates = [...withdrawalRates];
    newRates[index][field] = parseFloat(value) || 0;
    setWithdrawalRates(newRates);
  };

  const applyPresetStrategy = (strategyKey) => {
    setSelectedPreset(strategyKey);
    if (strategyKey === 'dieWithNothing') {
      setWithdrawalRates(calculateDieWithNothingStrategy());
      setWithdrawalType('dollar');
    } else {
      setWithdrawalRates([...presetStrategies[strategyKey].rates]);
      setWithdrawalType('percentage');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Advanced Retirement Planning Calculator</h1>
          <button
            onClick={exportToPDF}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF Report
          </button>
        </div>
        
        {/* Basic Settings */}
        <div className="bg-blue-50 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">Basic Settings</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Starting Year</label>
              <input type="number" value={startingYear} onChange={(e) => setStartingYear(parseInt(e.target.value) || 2025)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Age</label>
              <input type="number" value={maxAge} onChange={(e) => setMaxAge(parseInt(e.target.value) || 95)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Age</label>
              <input type="number" value={currentAge} onChange={(e) => setCurrentAge(parseInt(e.target.value) || 35)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retirement Age</label>
              <input type="number" value={retirementAge} onChange={(e) => setRetirementAge(parseInt(e.target.value) || 65)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
              <input type="number" step="0.5" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 22)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filing Status</label>
              <select value={filingStatus} onChange={(e) => setFilingStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="single">Single</option>
                <option value="marriedJoint">Married Filing Jointly</option>
                <option value="marriedSeparate">Married Filing Separately</option>
                <option value="headOfHousehold">Head of Household</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pre-Retirement Return (%)</label>
              <input type="number" step="0.1" value={preRetirementReturn} onChange={(e) => setPreRetirementReturn(parseFloat(e.target.value) || 7)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Post-Retirement Return (%)</label>
              <input type="number" step="0.1" value={postRetirementReturn} onChange={(e) => setPostRetirementReturn(parseFloat(e.target.value) || 5)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volatility (%)</label>
              <input type="number" step="1" value={volatility} onChange={(e) => setVolatility(parseFloat(e.target.value) || 15)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
        </div>

        {/* Monte Carlo Simulation Section */}
        <div className="bg-yellow-50 p-6 rounded-lg mb-6 border-2 border-yellow-200">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800">Monte Carlo Risk Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Simulations</label>
              <input
                type="number"
                step="100"
                min="100"
                max="10000"
                value={numSimulations}
                onChange={(e) => setNumSimulations(parseInt(e.target.value) || 1000)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            
            <div className="flex items-center">
              <span className="text-sm text-gray-600">
                {isRunningMonteCarlo ? 'Running simulations...' : 
                 monteCarloComplete ? `Completed ${numSimulations} simulations` : 
                 'Ready to run simulations'}
              </span>
            </div>
            
            <button
              onClick={runMonteCarloSimulation}
              disabled={isRunningMonteCarlo}
              className={`px-6 py-3 rounded-md text-white font-medium transition-colors text-lg ${
                isRunningMonteCarlo 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              {isRunningMonteCarlo ? 'Running...' : 'Run Monte Carlo Analysis'}
            </button>
          </div>
        </div>

        {/* Investment Accounts */}
        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-green-800">Investment Accounts (Tax-Efficient Order)</h2>
            <button onClick={addInvestmentAccount} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Add Account</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {investmentAccounts.sort((a, b) => a.withdrawalOrder - b.withdrawalOrder).map((account) => (
              <div key={account.id} className="bg-white p-4 rounded-md border-2 border-green-200">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">#{account.withdrawalOrder}</span>
                      <input
                        type="text"
                        value={account.name}
                        onChange={(e) => updateInvestmentAccount(account.id, 'name', e.target.value)}
                        className="font-medium text-gray-800 bg-transparent border-none p-0 focus:ring-0 flex-1"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeInvestmentAccount(account.id)}
                    className="text-red-600 hover:text-red-800 text-sm ml-2 px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Balance</label>
                    <input type="number" value={account.balance} onChange={(e) => updateInvestmentAccount(account.id, 'balance', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Order</label>
                    <input type="number" value={account.withdrawalOrder} onChange={(e) => updateInvestmentAccount(account.id, 'withdrawalOrder', parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select value={account.type} onChange={(e) => updateInvestmentAccount(account.id, 'type', e.target.value)} className="w-full px-2 py-1 border rounded text-sm">
                      <option value="taxable">Taxable (Capital gains rates)</option>
                      <option value="traditional">Traditional 401k/IRA/TSP (Full tax rate)</option>
                      <option value="roth">Roth IRA/TSP (Tax-free)</option>
                      <option value="hsa">HSA (Tax-free)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min Age</label>
                    <input type="number" step="0.5" value={account.minAge} onChange={(e) => updateInvestmentAccount(account.id, 'minAge', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-green-100 rounded-md">
            <div className="text-sm font-medium text-green-800">Total: {formatCurrency(totalInvestmentAccounts)}</div>
          </div>
        </div>

        {/* Income Streams */}
        <div className="bg-purple-50 p-6 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-purple-800">Fixed Income Streams</h2>
            <button onClick={addIncomeStream} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">Add Stream</button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {incomeStreams.map((stream) => (
              <div key={stream.id} className="bg-white p-4 rounded-md border-2 border-purple-200">
                <div className="flex justify-between items-start mb-3">
                  <input
                    type="text"
                    value={stream.name}
                    onChange={(e) => updateIncomeStream(stream.id, 'name', e.target.value)}
                    className="font-medium text-gray-800 bg-transparent border-none p-0 focus:ring-0 flex-1"
                  />
                  <button
                    onClick={() => removeIncomeStream(stream.id)}
                    className="text-red-600 hover:text-red-800 text-sm ml-2 px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {stream.isAnnual ? 'Annual Amount' : 'Monthly Amount'}
                    </label>
                    <input
                      type="number"
                      value={stream.monthlyAmount}
                      onChange={(e) => updateIncomeStream(stream.id, 'monthlyAmount', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">COLA (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={stream.cola}
                      onChange={(e) => updateIncomeStream(stream.id, 'cola', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Age</label>
                    <input
                      type="number"
                      value={stream.startAge}
                      onChange={(e) => updateIncomeStream(stream.id, 'startAge', parseInt(e.target.value) || 65)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">End Age</label>
                    <input
                      type="number"
                      value={stream.endAge}
                      onChange={(e) => updateIncomeStream(stream.id, 'endAge', parseInt(e.target.value) || 95)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="flex items-center text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={stream.taxable}
                      onChange={(e) => updateIncomeStream(stream.id, 'taxable', e.target.checked)}
                      className="mr-2"
                    />
                    Taxable Income
                  </label>
                  
                  <label className="flex items-center text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={stream.isAnnual}
                      onChange={(e) => updateIncomeStream(stream.id, 'isAnnual', e.target.checked)}
                      className="mr-2"
                    />
                    Annual Amount
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Withdrawal Strategy */}
        <div className="bg-red-50 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold text-red-800 mb-4">Withdrawal Strategy</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Withdrawal Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input type="radio" value="percentage" checked={withdrawalType === 'percentage'} onChange={(e) => setWithdrawalType(e.target.value)} className="mr-2" />
                Percentage
              </label>
              <label className="flex items-center">
                <input type="radio" value="dollar" checked={withdrawalType === 'dollar'} onChange={(e) => setWithdrawalType(e.target.value)} className="mr-2" />
                Dollar Amount
              </label>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-800 mb-3">Preset Strategies</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(presetStrategies).map(([key, strategy]) => (
                <button 
                  key={key} 
                  onClick={() => applyPresetStrategy(key)} 
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    selectedPreset === key 
                      ? 'bg-red-600 text-white border-red-600' 
                      : 'bg-white border-red-200 hover:border-red-400 hover:bg-red-50'
                  }`}
                >
                  <div className="font-medium text-sm">{strategy.name}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-red-800">Custom Withdrawal Tiers</h3>
            <button
              onClick={addWithdrawalTier}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Add Tier
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {withdrawalRates.map((tier, index) => (
              <div key={index} className="bg-white p-4 rounded-md border-2 border-red-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-800">Tier {index + 1}</h3>
                  {withdrawalRates.length > 1 && (
                    <button
                      onClick={() => removeWithdrawalTier(index)}
                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Age</label>
                    <input type="number" value={tier.ageStart} onChange={(e) => updateWithdrawalRate(index, 'ageStart', e.target.value)} className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">End Age</label>
                    <input type="number" value={tier.ageEnd} onChange={(e) => updateWithdrawalRate(index, 'ageEnd', e.target.value)} className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                </div>
                
                {withdrawalType === 'percentage' ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rate (%)</label>
                    <input type="number" step="0.1" value={tier.rate} onChange={(e) => updateWithdrawalRate(index, 'rate', e.target.value)} className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Annual Amount ($)</label>
                    <input type="number" value={tier.dollarAmount} onChange={(e) => updateWithdrawalRate(index, 'dollarAmount', e.target.value)} className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Retirement Projection</h2>
            
            {monteCarloComplete && monteCarloResults.length > 0 && (
              <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <h3 className="text-xl font-semibold text-blue-800 mb-4">Monte Carlo Results ({monteCarloResults[0].totalSimulations} simulations)</h3>
                
                {/* Debug Information */}
                {monteCarloResults[0].debugInfo && (
                  <div className="mb-4 p-4 bg-yellow-100 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2">Debug Information</h4>
                    <div className="text-sm text-gray-700">
                      <p>Raw Counts: {JSON.stringify(monteCarloResults[0].debugInfo.rawCounts)}</p>
                      <p>Total Simulations: {monteCarloResults[0].debugInfo.totalSimulations}</p>
                      <div className="mt-2">
                        <p>Percentage Calculations:</p>
                        {Object.entries(monteCarloResults[0].debugInfo.percentageCheck || {}).map(([age, calc]) => (
                          <p key={age} className="ml-4">• {age}: {calc}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">Final Portfolio Values</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">10th Percentile (Low)</div>
                        <div className="text-lg font-bold text-red-600">{formatCurrency(monteCarloResults[0].p10)}</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">25th Percentile</div>
                        <div className="text-lg font-bold text-orange-600">{formatCurrency(monteCarloResults[0].p25)}</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">50th Percentile (Median)</div>
                        <div className="text-lg font-bold text-blue-600">{formatCurrency(monteCarloResults[0].p50)}</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">75th Percentile</div>
                        <div className="text-lg font-bold text-green-600">{formatCurrency(monteCarloResults[0].p75)}</div>
                      </div>
                      <div className="bg-white p-3 rounded border col-span-2">
                        <div className="text-sm text-gray-600">90th Percentile (High)</div>
                        <div className="text-lg font-bold text-green-700">{formatCurrency(monteCarloResults[0].p90)}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">Portfolio Survival Probability</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm font-medium">Age 70:</span>
                        <span className="text-lg font-bold text-green-600">{monteCarloResults[0].survivalProbabilities.age70}%</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm font-medium">Age 80:</span>
                        <span className="text-lg font-bold text-blue-600">{monteCarloResults[0].survivalProbabilities.age80}%</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm font-medium">Age 90:</span>
                        <span className="text-lg font-bold text-orange-600">{monteCarloResults[0].survivalProbabilities.age90}%</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm font-medium">Age 95:</span>
                        <span className="text-lg font-bold text-red-600">{monteCarloResults[0].survivalProbabilities.age95}%</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm font-medium">Age 100:</span>
                        <span className="text-lg font-bold text-purple-600">{monteCarloResults[0].survivalProbabilities.age100}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="h-96 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.filter(r => r.age >= retirementAge)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" />
                  <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomBalanceTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={3} name="Investment Balance" />
                  <Line type="monotone" dataKey="totalGrossIncome" stroke="#16a34a" strokeWidth={2} name="Total Gross Income" />
                  <Line type="monotone" dataKey="totalNetIncome" stroke="#059669" strokeWidth={2} strokeDasharray="5 5" name="Total Net Income (After Tax)" />
                  <Line type="monotone" dataKey="totalTaxes" stroke="#dc2626" strokeWidth={2} name="Annual Taxes" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-64 mb-6">
              <h3 className="text-lg font-semibold mb-2">Annual Income Breakdown</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={results.filter(r => r.age >= retirementAge)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" />
                  <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomIncomeTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="withdrawal" stackId="1" stroke="#8884d8" fill="#8884d8" name="Investment Withdrawals" />
                  <Area type="monotone" dataKey="grossFixedIncome" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Fixed Income" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowDetailedTable(!showDetailedTable)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform ${showDetailedTable ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">
                  {showDetailedTable ? 'Hide' : 'Show'} Detailed Year-by-Year Projection
                </span>
              </button>
              
              {showDetailedTable && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left">Age</th>
                        <th className="px-4 py-2 text-left">Year</th>
                        <th className="px-4 py-2 text-left">Balance</th>
                        <th className="px-4 py-2 text-left">Withdrawal</th>
                        <th className="px-4 py-2 text-left">Fixed Income</th>
                        <th className="px-4 py-2 text-left">Gross Income</th>
                        <th className="px-4 py-2 text-left">Taxes</th>
                        <th className="px-4 py-2 text-left">Net Income</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.filter((_, index) => index % 5 === 0 || results[index].age >= retirementAge).map((row, index) => (
                        <tr key={index} className={row.age >= retirementAge ? "bg-green-50" : ""}>
                          <td className="px-4 py-2">{row.age}</td>
                          <td className="px-4 py-2">{row.year}</td>
                          <td className="px-4 py-2">{formatCurrency(row.balance)}</td>
                          <td className="px-4 py-2">{formatCurrency(row.withdrawal)}</td>
                          <td className="px-4 py-2">{formatCurrency(row.grossFixedIncome)}</td>
                          <td className="px-4 py-2 font-medium">{formatCurrency(row.totalGrossIncome)}</td>
                          <td className="px-4 py-2 text-red-600">{formatCurrency(row.totalTaxes)}</td>
                          <td className="px-4 py-2 font-bold text-green-600">{formatCurrency(row.totalNetIncome)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-800">{formatCurrency(totalInvestmentAccounts)}</div>
                <div className="text-sm text-gray-600">Total Investment Accounts</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {results.find(r => r.age === retirementAge) ? 
                    formatCurrency(results.find(r => r.age === retirementAge).totalNetIncome) : 
                    formatCurrency(0)}
                </div>
                <div className="text-sm text-gray-600">First Year Net Income</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {results.length > 0 ? results[results.length - 1].age : maxAge}
                </div>
                <div className="text-sm text-gray-600">Money Lasts Until Age</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RetirementCalculator;