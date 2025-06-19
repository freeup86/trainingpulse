function SimpleAnalyticsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <p className="mt-4 text-gray-600">Analytics page is working!</p>
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900">Sample Analytics Data</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">Total Courses</p>
            <p className="text-2xl font-bold text-blue-900">24</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Completed</p>
            <p className="text-2xl font-bold text-green-900">18</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-yellow-600">In Progress</p>
            <p className="text-2xl font-bold text-yellow-900">6</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimpleAnalyticsPage;