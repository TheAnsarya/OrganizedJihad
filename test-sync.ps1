# Test script for OrganizedJihad API sync functionality
# Tests all endpoints to verify the sync client works correctly

Write-Host "`n=== OrganizedJihad API Sync Test ===`n" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "Test 1: Health Check Endpoint" -ForegroundColor Yellow
try {
	$health = Invoke-RestMethod -Uri "http://localhost:5124/api/sync/health" -Method Get
	Write-Host "✓ Health Check: $($health.status)" -ForegroundColor Green
	Write-Host "  Version: $($health.version)" -ForegroundColor Gray
	Write-Host "  Timestamp: $($health.timestamp)" -ForegroundColor Gray
}
catch {
	Write-Host "✗ Health Check Failed: $_" -ForegroundColor Red
	Write-Host "`nMake sure the API is running with: dotnet run --project api`n" -ForegroundColor Yellow
	exit 1
}

# Test 2: Get Last Sync
Write-Host "`nTest 2: Get Last Sync Timestamp" -ForegroundColor Yellow
try {
	$lastSync = Invoke-RestMethod -Uri "http://localhost:5124/api/sync/last-sync" -Method Get
	if ($lastSync.lastSync) {
		Write-Host "✓ Last Sync: $($lastSync.lastSync)" -ForegroundColor Green
	}
	else {
		Write-Host "✓ Last Sync: (none yet)" -ForegroundColor Green
	}
}
catch {
	Write-Host "✗ Last Sync Failed: $_" -ForegroundColor Red
}

# Test 3: Get Stats
Write-Host "`nTest 3: Get Database Stats" -ForegroundColor Yellow
try {
	$stats = Invoke-RestMethod -Uri "http://localhost:5124/api/sync/stats" -Method Get
	Write-Host "✓ Database Stats:" -ForegroundColor Green
	Write-Host "  Total Records: $($stats.totalRecords)" -ForegroundColor Gray
	Write-Host "  Player Snapshots: $($stats.totalSnapshots)" -ForegroundColor Gray
	Write-Host "  Arena Battles: $($stats.totalArenaBattles)" -ForegroundColor Gray
	Write-Host "  Grand Arena Battles: $($stats.totalGrandArenaBattles)" -ForegroundColor Gray
	Write-Host "  Titan Arena Battles: $($stats.totalTitanArenaBattles)" -ForegroundColor Gray
	Write-Host "  Guild War Battles: $($stats.totalGuildWarBattles)" -ForegroundColor Gray
	Write-Host "  Raid Boss Attacks: $($stats.totalRaidBossAttacks)" -ForegroundColor Gray
	Write-Host "  Chest Openings: $($stats.totalChestOpenings)" -ForegroundColor Gray
	Write-Host "  Opponents: $($stats.totalOpponents)" -ForegroundColor Gray
	Write-Host "  Goals: $($stats.totalGoals)" -ForegroundColor Gray
	Write-Host "  Calendar Events: $($stats.totalCalendarEvents)" -ForegroundColor Gray
}
catch {
	Write-Host "✗ Stats Failed: $_" -ForegroundColor Red
}

# Test 4: Test Import with Sample Data
Write-Host "`nTest 4: Import Sample Data" -ForegroundColor Yellow
$sampleData = @{
	currentSnapshot = @{
		playerId = 123456789
		playerName = "TestPlayer"
		level = 120
		teamLevel = 150
		power = 500000
		arenaRank = 42
		grandArenaRank = 123
		titanArenaRank = 456
		gold = 1000000
		emeralds = 5000
		timestamp = (Get-Date).ToUniversalTime().ToString("o")
	}
	arenaBattles = @(
		@{
			opponentId = 987654321
			opponentName = "TestOpponent"
			isWin = $true
			playerPower = 500000
			opponentPower = 480000
			playerHeroes = '["Hero1","Hero2","Hero3","Hero4","Hero5"]'
			opponentHeroes = '["Hero6","Hero7","Hero8","Hero9","Hero10"]'
			rewards = '{"gold":1000,"experience":500}'
			timestamp = (Get-Date).ToUniversalTime().ToString("o")
		}
	)
	grandArenaBattles = @()
	titanArenaBattles = @()
	guildWarBattles = @()
	raidBossAttacks = @()
	chestOpenings = @(
		@{
			chestType = "Heroic"
			quantity = 1
			openMethod = "Key"
			timestamp = (Get-Date).ToUniversalTime().ToString("o")
			chestDrops = @(
				@{
					itemType = "Hero Soul Stone"
					itemId = 1
					quantity = 50
					rarity = "Rare"
				}
			)
		}
	)
	opponents = @(
		@{
			opponentId = 987654321
			opponentName = "TestOpponent"
			level = 118
			power = 480000
			lastSeen = (Get-Date).ToUniversalTime().ToString("o")
			lastBattleType = "Arena"
			totalBattles = 5
			totalWins = 3
			totalLosses = 2
			winRate = 0.6
			teamComposition = '["Hero6","Hero7","Hero8","Hero9","Hero10"]'
		}
	)
	goals = @(
		@{
			title = "Test Goal"
			description = "This is a test goal"
			isShortTerm = $true
			targetValue = 100
			currentValue = 50
			isCompleted = $false
			createdAt = (Get-Date).ToUniversalTime().ToString("o")
		}
	)
	calendarEvents = @(
		@{
			title = "Test Event"
			description = "This is a test calendar event"
			eventDate = (Get-Date).AddDays(7).ToUniversalTime().ToString("o")
			isRecurring = $false
			isCompleted = $false
			createdAt = (Get-Date).ToUniversalTime().ToString("o")
		}
	)
} | ConvertTo-Json -Depth 10

try {
	$importResult = Invoke-RestMethod -Uri "http://localhost:5124/api/sync/import" -Method Post -Body $sampleData -ContentType "application/json"
	Write-Host "✓ Import Successful!" -ForegroundColor Green
	Write-Host "  Success: $($importResult.success)" -ForegroundColor Gray
	Write-Host "  Message: $($importResult.message)" -ForegroundColor Gray
	Write-Host "  Sync Timestamp: $($importResult.syncTimestamp)" -ForegroundColor Gray
	Write-Host "  Imported Counts:" -ForegroundColor Gray
	Write-Host "    Player Snapshots: $($importResult.importedCounts.playerSnapshots)" -ForegroundColor Gray
	Write-Host "    Arena Battles: $($importResult.importedCounts.arenaBattles)" -ForegroundColor Gray
	Write-Host "    Chest Openings: $($importResult.importedCounts.chestOpenings)" -ForegroundColor Gray
	Write-Host "    Opponents: $($importResult.importedCounts.opponents)" -ForegroundColor Gray
	Write-Host "    Goals: $($importResult.importedCounts.goals)" -ForegroundColor Gray
	Write-Host "    Calendar Events: $($importResult.importedCounts.calendarEvents)" -ForegroundColor Gray
}
catch {
	Write-Host "✗ Import Failed: $_" -ForegroundColor Red
	if ($_.ErrorDetails.Message) {
		Write-Host "  Error Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
	}
}

# Test 5: Verify Stats Updated
Write-Host "`nTest 5: Verify Database Updated" -ForegroundColor Yellow
try {
	$statsAfter = Invoke-RestMethod -Uri "http://localhost:5124/api/sync/stats" -Method Get
	Write-Host "✓ Updated Database Stats:" -ForegroundColor Green
	Write-Host "  Total Records: $($statsAfter.totalRecords)" -ForegroundColor Gray
	Write-Host "  Player Snapshots: $($statsAfter.totalSnapshots)" -ForegroundColor Gray
	Write-Host "  Arena Battles: $($statsAfter.totalArenaBattles)" -ForegroundColor Gray
	Write-Host "  Chest Openings: $($statsAfter.totalChestOpenings)" -ForegroundColor Gray
	Write-Host "  Opponents: $($statsAfter.totalOpponents)" -ForegroundColor Gray
	Write-Host "  Goals: $($statsAfter.totalGoals)" -ForegroundColor Gray
	Write-Host "  Calendar Events: $($statsAfter.totalCalendarEvents)" -ForegroundColor Gray
}
catch {
	Write-Host "✗ Stats Verification Failed: $_" -ForegroundColor Red
}

Write-Host "`n=== All Tests Complete! ===`n" -ForegroundColor Cyan
