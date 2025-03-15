"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Card from '@/components/Card';
import QRCode from '@/components/QRCode';
import { Table, GamePhase } from '@/lib/types';
import { getTableJoinUrl } from '@/lib/ipUtils';

// Helper function to get the appropriate button text based on game phase
function getButtonText(phase: GamePhase): string {
  switch (phase) {
    case 'Waiting':
      return 'Deal';
    case 'Pre-Flop':
      return 'Show Flop';
    case 'Flop':
      return 'Show Turn';
    case 'Turn':
      return 'Show River';
    case 'River':
      return 'Shuffle';
    default:
      return 'Advance Game';
  }
}

export default function TablePage() {
  const params = useParams();
  const { tableGuid } = params;
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(0);
  
  // Define fetch function with useCallback before using it
  const fetchTable = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/tables/${tableGuid}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch table');
      }
      
      const newTable = data.table;
      
      // Check if player count has changed
      const hasNewPlayers = table && newTable.players.length !== table.players.length;
      
      setTable(newTable);
      setLastUpdated(new Date());
      
      // Always set player count on first load
      if (!table) {
        setPlayerCount(newTable.players.length);
      }
      // Update player count and trigger animation if changed
      else if (hasNewPlayers) {
        console.log(`Player count changed from ${playerCount} to ${newTable.players.length}`);
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tableGuid]);
  
  // Fetch initial table data
  useEffect(() => {
    fetchTable();

    // Set up polling to refresh table data every 5 seconds
    const pollingInterval = setInterval(() => {
      fetchTable();
    }, 5000);
    
    // Clean up interval on unmount
    return () => clearInterval(pollingInterval);
  }, [fetchTable]);
  
  // Handle key press for advancing game phase
  const handleKeyPress = useCallback(async (event: KeyboardEvent) => {
    if ((event.code === 'Space' || event.code === 'Enter') && table && !isAdvancing) {
      event.preventDefault();
      setIsAdvancing(true);
      
      try {
        const response = await fetch(`/api/tables/${tableGuid}`, {
          method: 'POST',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to advance game phase');
        }
        
        // Update local table state immediately
        if (data.table) {
          setTable(data.table);
          setLastUpdated(new Date());
        }
        
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsAdvancing(false);
      }
    }
  }, [table, tableGuid, isAdvancing]);
  
  // Set up key listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);
  
  // Sync player count with table after animation delay
  useEffect(() => {
    if (table) {
      // After 3 seconds, update playerCount to match current table
      const timer = setTimeout(() => {
        setPlayerCount(table.players.length);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [table?.players.length]);
  
  // Generate join URL with proper IP address
  // useState to ensure URL is correctly set after client-side rendering
  const [joinUrl, setJoinUrl] = useState<string>('');
  
  // Update the join URL after component mounts (client-side only)
  useEffect(() => {
    setJoinUrl(getTableJoinUrl(tableGuid.toString()));
  }, [tableGuid]);
  
  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      await fetchTable();
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  if (loading) {
    // return <div className="container mx-auto px-4 py-8">Loading table...</div>;
  }
  
  // Handle connection errors by setting a state but not showing an error message
  const [connectionError, setConnectionError] = useState<boolean>(false);
  
  useEffect(() => {
    if (error) {
      // Track connection errors but don't show an error page
      setConnectionError(true);
      console.error('Connection error:', error);
    } else {
      setConnectionError(false);
    }
  }, [error]);
  
  // Only show critical errors that prevent the app from functioning
  if (error && !table) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          Unable to load table data.
          <button 
            onClick={handleRefresh} 
            className="ml-4 px-3 py-1 bg-white text-red-700 border border-red-500 rounded hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (!table) {
    return <div className="container mx-auto px-4 py-8">Table not found</div>;
  }
  
  return (
    <div className="container mx-auto px-2 py-2">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">
          Table: {tableGuid.toString().substring(0, 4)}...
        </h1>
        <div className="flex items-center">
          {connectionError ? (
            <span 
              className="inline-block rounded-full h-3 w-3 bg-red-500"
              title="Connection error - trying to reconnect"
            ></span>
          ) : lastUpdated ? (
            <span 
              className={`inline-block rounded-full h-3 w-3 ${
                new Date().getTime() - lastUpdated.getTime() < 12000 
                  ? 'bg-green-500' 
                  : 'bg-red-500'
              }`} 
              title={`Last updated: ${lastUpdated.toLocaleTimeString()}`}
            ></span>
          ) : (
            <span className="inline-block rounded-full h-3 w-3 bg-gray-400" title="Waiting for update"></span>
          )}
        </div>
      </div>
      
      {/* Community Cards - Full width prominent display */}
      <div className="mb-4">
        <div className="card p-2 md:p-4">
          <h2 className="text-xl font-semibold mb-2">Community Cards</h2>
          
          {table.gamePhase === 'Waiting' ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-xl font-light">Waiting to start next hand...</p>
              <p className="mt-2 text-sm">Press the Deal button to begin</p>
            </div>
          ) : table.gamePhase === 'Pre-Flop' ? (
            <div className="text-center py-16">
              <p className="text-xl font-light">Waiting for the flop...</p>
              <p className="mt-2 text-sm">Press the Show Flop button when players are ready</p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2 md:gap-4 lg:gap-6 py-4 md:py-6">
              {table.communityCards.map((card, index) => (
                <div key={index} className="transform hover:scale-105 transition-transform duration-200">
                  <Card card={card} size="lg" />
                </div>
              ))}
              
              {/* Show placeholders for remaining community cards */}
              {Array.from({ length: 5 - table.communityCards.length }).map((_, index) => (
                <div key={`placeholder-${index}`} className="transform hover:scale-105 transition-transform duration-200">
                  <Card size="lg" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Game controls and info - 3 column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Game Info Panel */}
        <div className="card p-2 md:p-3">
          <h2 className="text-lg font-semibold mb-2">Game Info</h2>
          <p className="mb-1 text-sm"><strong>Phase:</strong> {table.gamePhase}</p>
          <p className="mb-1 text-sm"><strong>Hand ID:</strong> {table.handId.substring(0, 4)}...</p>
          <p className="mb-1 text-sm"><strong>Players:</strong> {table.players.length}/{table.maxPlayers}</p>
          <div className="flex space-x-2 mt-2">
            <button 
              onClick={() => handleKeyPress({ code: 'Space', preventDefault: () => {} } as KeyboardEvent)} 
              disabled={isAdvancing}
              className="btn text-sm py-1"
            >
              {isAdvancing ? 'Advancing...' : getButtonText(table.gamePhase)}
            </button>
            <button 
              onClick={handleRefresh} 
              className="btn-secondary text-sm py-1"
              disabled={isAdvancing}
            >
              Refresh
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Press Space or Enter to advance
          </p>
        </div>
        
        {/* Join Table Panel */}
        <div className="card p-2 md:p-3">
          <h2 className="text-lg font-semibold mb-2">Join Table</h2>
          <p className="mb-2 text-sm">Scan QR code to join:</p>
          <div className="flex justify-center mb-2">
            <QRCode url={joinUrl} size={100} />
          </div>
          <div className="bg-gray-100 p-1 rounded text-xs break-all text-center">
            {joinUrl}
          </div>
        </div>
        
        {/* Player List Panel */}
        <div className="card p-2 md:p-3">
          <h2 className="text-lg font-semibold mb-2">
            Players 
            <span className="ml-2 text-xs text-gray-500">
              ({table.players.length}/{table.maxPlayers})
            </span>
            {playerCount !== table.players.length && (
              <span className="ml-1 text-xs bg-yellow-100 px-1 rounded-full animate-pulse">
                Updated
              </span>
            )}
          </h2>
          
          {table.players.length === 0 ? (
            <p className="text-sm">No players seated yet</p>
          ) : (
            <div className="divide-y max-h-40 overflow-y-auto text-sm">
              {table.players.map((player, index) => {
                // Check if this is a new player (added since last render)
                const isNewPlayer = index >= playerCount;
                
                return (
                  <div 
                    key={player.playerGuid} 
                    className={`py-1 ${isNewPlayer ? 'bg-yellow-50 animate-pulse' : ''}`}
                  >
                    <p>
                      P{index+1}: {player.playerGuid.substring(0, 4)}...
                      {isNewPlayer && (
                        <span className="ml-1 text-xs text-green-600 font-semibold">
                          New
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
