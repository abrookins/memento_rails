class AddStartingLocationToMap < ActiveRecord::Migration
  def change
    add_column :maps, :starting_location, :string

  end
end
