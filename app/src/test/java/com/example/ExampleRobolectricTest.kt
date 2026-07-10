package com.example

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.example.data.*
import com.example.ui.MarketViewModel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

    private lateinit var db: AppDatabase
    private lateinit var viewModel: MarketViewModel

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
            
        viewModel = MarketViewModel(
            db.userDao(),
            db.productDao(),
            db.savedProductDao(),
            db.orderDao(),
            db.chatReportDao(),
            db.cartItemDao(),
            db.bankCardDao(),
            db.searchQueryDao(),
            db.familyShoppingListDao(),
            db.storedOrganicItemDao()
        )
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun testViewModelInitialization() {
        assertNotNull(viewModel)
    }

    @Test
    fun testSearchHistoryFlowAndStateTransitions() = runBlocking {
        // Assert initial state is empty
        var recentSearches = viewModel.searchHistory.value
        assertEquals(0, recentSearches.size)

        // Add search query
        viewModel.addToSearchHistory("Product Lookup", "Organic Milk")
        
        recentSearches = viewModel.searchHistory.value
        assertEquals(1, recentSearches.size)
        assertEquals("Organic Milk", recentSearches[0].query)

        // Clear search history
        viewModel.clearSearchHistory()
        recentSearches = viewModel.searchHistory.value
        assertEquals(0, recentSearches.size)
    }
}
